export let drivers = {}

export default function applyDriver(obj) {
  drivers = obj
  Object.keys(drivers).forEach(key => {
    oldMap[key] = drivers[key].update
  })
}

export const oldMap = {}

