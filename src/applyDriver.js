import {Subject} from 'rxjs'

export let driverIn = {}
export let driverOut = {}

export default function _applyDriver(applyDrivers) {
  Object.keys(applyDrivers).forEach(key => {
    driverIn[key] = new Subject()
    driverOut[key] = applyDrivers[key](driverIn[key])
  })
}

