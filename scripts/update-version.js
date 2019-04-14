const { exec, execSync } = require('child_process')
const { join } = require('path')
const { readJson, writeJson } = require('fs-extra')

const run = async () => {
  const packageJSONPath = join('.', 'package.json')
  const packageJSON = await readJson(packageJSONPath)
  let version = packageJSON.version
  const name = execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
  if (name == 'dev') {
    const tep = version.split('.').map(num => parseInt(num))
    const addVersion = (arr, str = '') => {
      if (arr.length == 1) {
        return arr[0] + 1 + str
      }
      arr[arr.length - 1] = arr[arr.length - 1] + 1
      if (arr[arr.length - 1] < 10) {
        return arr.join('.') + str
      } else {
        arr.pop()
        str += '.0'
        return addVersion(arr, str)
      }
    }
    const newVersion = addVersion(tep)
    packageJSON.version = newVersion
    await writeJson(packageJSONPath, packageJSON, { spaces: 2 })
    execSync('git add ./package.json && git commit -m "version update" && git push', { cwd: process.cwd() })
    execSync('git checkout master && git merge dev', { cwd: process.cwd() })
    execSync(`git tag v${newVersion} && git push origin v${newVersion} && git push`, { cwd: process.cwd() })
  }
}

run()
