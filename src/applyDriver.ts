import { Observable, Subject } from 'rxjs'
import { Drivers } from './type'

type DriversIn = {
    [D in keyof Drivers]: Subject<any>
}

type DriversOut = {
    [D in keyof Drivers]: Observable<any>
}

export let driverIn: DriversIn = {}
export let driverOut: DriversOut = {}

export default function _applyDriver(drivers: Drivers):void {
    Object.keys(drivers).forEach(key => {
        driverIn[key] = new Subject()
        driverOut[key] = drivers[key](driverIn[key])
    })
}

