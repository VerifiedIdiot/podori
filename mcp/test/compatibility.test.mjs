import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

function documents(root) {
  return readdirSync(root,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?documents(join(root,entry.name)):entry.name.endsWith('.md')?[join(root,entry.name)]:[]);
}
test('A11: each existing skill remains self-contained without MCP and doubt remains non-executing', () => {
  const names=['podori','podori-egov','podori-doubt','podori-trap','podori-sandbox'];
  for(const name of names) {
    const root=resolve('..','skills',name), skill=readFileSync(join(root,'SKILL.md'),'utf8');
    assert.ok(existsSync(join(root,'LICENSE')), `Missing LICENSE in ${name}`);
    assert.match(skill,new RegExp(`^name: ${name}$`,'m'));
    const frontmatter=skill.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
    const metadata=frontmatter?.match(/^metadata:\r?\n((?:[ \t]+[^\r\n]*(?:\r?\n|$)|\r?\n)*)/m)?.[1];
    assert.match(metadata ?? '',/^ {2}version: (["'])\d+\.\d+\.\d+(?:[-+][\w.-]+)?\1\r?$/m);
    const version = metadata.match(/^ {2}version: (["'])([^"']+)\1\r?$/m)?.[2];
    assert.equal(version, JSON.parse(readFileSync('package.json', 'utf8')).version, `${name} version must match MCP`);
    if (name === 'podori-sandbox') {
      assert.match(skill, /Execution requires a separately prepared local MCP server\./);
      assert.match(skill, /This instruction package does not include that runtime\./);
    } else {
      assert.match(skill,/No other podori skill is required or invoked\./);
    }
    for(const file of documents(root))for(const match of readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)) {
      const target=match[1].split('#')[0];
      if(target && !/^[a-z]+:/.test(target)) {
        const destination=resolve(dirname(file),target);
        assert.ok(destination.startsWith(root+'/'),`A packaged reference leaves ${name}: ${target}`);
        assert.ok(existsSync(destination),`Missing packaged reference in ${name}: ${target}`);
        assert.ok(realpathSync(destination).startsWith(realpathSync(root)+'/'), `A packaged reference leaves ${name}: ${target}`);
      }
    }
  }
  const doubt=readFileSync('../skills/podori-doubt/SKILL.md','utf8');
  assert.match(doubt,/Never install, import, build, or execute suspect/);
  assert.match(doubt,/read-only dependency and image inspection/);
});
