"""Prepare the fixed native runtime on a disposable GitHub runner."""

import hashlib
import json
import os
import platform
import subprocess
import tarfile
from pathlib import Path

RELEASE = "release-20261026.0"
PINS = {
    "amd64": ("x86_64", "096589d2d6078ba4caa26aa0200932f571aa5da9d08a5156b98ab1d93fa54468"),
    "arm64": ("aarch64", "6b03c9d53f46b5ac56fd32522f38f108645e9f80a26a335e86ad1e09dcdaefda"),
}
BASE_IMAGE = "docker.io/library/node@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5"
KATA = ("4.3.1", "66b35b06f6b41b56f8606ddf3ed3e5660b0971d1e309d903457c4056a0b9eff0")
KATA_SHIM = "/opt/kata/bin/containerd-shim-kata-v2"
KATA_DEFAULT = Path("/opt/kata/share/defaults/kata-containers/configuration-qemu.toml")
MEMBERS = {
    "containerd-shim-runsc-v1", "runsc", "gvisor-bin",
    "gvisor-bin/checkpointgofer", "gvisor-bin/gvisor-proc-umounter",
    "gvisor-bin/gvisor-sentry-prewarmer", "gvisor-bin/gvisor_sentry",
    "gvisor-bin/runsc-fd-parking", "gvisor-bin/runsc-metric-server",
}


def run(args, timeout=60):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=timeout).stdout.strip()


def install_kata(arch, temporary):
    """Install the Go runtime that Kata documents for Docker, with guest seccomp enabled."""
    version, expected = KATA
    if arch != "amd64" or not Path("/dev/kvm").exists():
        raise RuntimeError("kvm-amd64-runner-required")
    if Path("/opt/kata").exists() or Path("/etc/kata-containers").exists():
        raise RuntimeError("runtime-destination-already-exists")
    # A runner image can ship its own daemon.json. Add the runtime and keep the rest.
    daemon = json.loads(run(["sudo", "cat", "/etc/docker/daemon.json"])) if Path("/etc/docker/daemon.json").exists() else {}
    if not isinstance(daemon, dict) or not isinstance(daemon.get("runtimes", {}), dict) or "kata" in daemon.get("runtimes", {}):
        raise RuntimeError("runtime-registration-already-exists")
    daemon.setdefault("runtimes", {})["kata"] = {"runtimeType": KATA_SHIM}
    archive = temporary / "podori-kata.tar.zst"
    url = f"https://github.com/kata-containers/kata-containers/releases/download/{version}/kata-go-static-{version}-{arch}.tar.zst"
    run(["curl", "--fail", "--silent", "--show-error", "--location", "--proto", "=https", "--proto-redir", "=https", "--max-time", "300", "--max-filesize", "1500000000", url, "--output", str(archive)], 310)
    digest = hashlib.sha256()
    with archive.open("rb") as source:
        for block in iter(lambda: source.read(1 << 20), b""):
            digest.update(block)
    if digest.hexdigest() != expected:
        raise RuntimeError("runtime-archive-digest-mismatch")
    names = run(["tar", "--zstd", "-tf", str(archive)], 120).splitlines()
    if not names or any(not (name == "./" or name.startswith(("opt/kata/", "./opt/kata/")) or name in ("opt/", "./opt/")) or ".." in name.split("/") for name in names):
        raise RuntimeError("runtime-archive-members-mismatch")
    run(["sudo", "tar", "--zstd", "--no-same-owner", "-xf", str(archive), "-C", "/"], 180)
    settings = KATA_DEFAULT.read_text()
    if settings.count("disable_guest_seccomp = true") != 1:
        raise RuntimeError("runtime-configuration-unexpected")
    run(["sudo", "mkdir", "-p", "/etc/kata-containers"])
    subprocess.run(["sudo", "tee", "/etc/kata-containers/configuration.toml"], input=settings.replace("disable_guest_seccomp = true", "disable_guest_seccomp = false"), check=True, capture_output=True, text=True, timeout=30)
    subprocess.run(["sudo", "tee", "/etc/docker/daemon.json"], input=json.dumps(daemon), check=True, capture_output=True, text=True, timeout=30)
    print(run(["/opt/kata/bin/kata-runtime", "--version"]))
    run(["sudo", "systemctl", "reload", "docker"])


def main():
    if os.environ.get("GITHUB_ACTIONS") != "true" or platform.system() != "Linux":
        raise RuntimeError("disposable-github-linux-runner-required")
    arch = {"x86_64": "amd64", "aarch64": "arm64"}.get(platform.machine())
    if arch != os.environ["PODORI_EXPECTED_ARCH"] or arch not in PINS:
        raise RuntimeError("native-architecture-mismatch")
    runtime = os.environ["PODORI_TEST_RUNTIME"]
    if runtime not in {"runc", "runsc", "kata"}:
        raise RuntimeError("unsupported-runtime")
    temporary = Path(os.environ["RUNNER_TEMP"])
    evidence = Path(os.environ["PODORI_EVIDENCE_DIR"])
    if evidence.parent.resolve() != temporary.resolve():
        raise RuntimeError("private-runner-evidence-required")
    evidence.mkdir(mode=0o700)
    if runtime == "runsc":
        release_arch, expected = PINS[arch]
        archive = temporary / "podori-gvisor.tar.bz2"
        url = f"https://github.com/google/gvisor/releases/download/{RELEASE}/gvisor-{release_arch}.tar.bz2"
        run(["curl", "--fail", "--silent", "--show-error", "--location", "--proto", "=https", "--proto-redir", "=https", "--max-time", "120", "--max-filesize", "150000000", url, "--output", str(archive)], 130)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
            raise RuntimeError("runtime-archive-digest-mismatch")
        with tarfile.open(archive, "r:bz2") as bundle:
            members = bundle.getmembers()
            if len(members) != len(MEMBERS) or {item.name for item in members} != MEMBERS:
                raise RuntimeError("runtime-archive-members-mismatch")
            if any(not (item.isfile() or item.isdir()) for item in members):
                raise RuntimeError("runtime-archive-type-mismatch")
            if any((Path("/usr/local/bin") / item.name).exists() for item in members):
                raise RuntimeError("runtime-destination-already-exists")
        run(["sudo", "tar", "--no-same-owner", "-xjf", str(archive), "-C", "/usr/local/bin"])
        print(run(["/usr/local/bin/runsc", "--version"]))
        run(["sudo", "/usr/local/bin/runsc", "install"])
        run(["sudo", "systemctl", "reload", "docker"])
    if runtime == "kata":
        install_kata(arch, temporary)
    info = json.loads(run(["docker", "info", "--format", "{{json .}} "]))
    if runtime not in info["Runtimes"]:
        raise RuntimeError("selected-runtime-not-registered")
    print(json.dumps({"architecture": arch, "runtime": runtime, "registered_runtime": info["Runtimes"][runtime]}))
    run(["docker", "pull", "--platform", f"linux/{arch}", BASE_IMAGE], 180)


if __name__ == "__main__":
    main()
