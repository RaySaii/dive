const { exec } = require('child_process')
const { join } = require('path')
const { readJson, writeJson } = require('fs-extra')

const run = async () => {
  const packageJSONPath = join('.', 'package.json')
  const packageJSON = await readJson(packageJSONPath)
  let version = packageJSON.version
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

  packageJSON.version = addVersion(tep)
  await writeJson(packageJSONPath, packageJSON, { spaces: 2 })

  exec('git commit -m "version update', { cwd: __dirname }, (error, stdout, stderr) => {
    if (error) {
      console.error(error)
      process.exit(1)
    }
  })

}

run()
