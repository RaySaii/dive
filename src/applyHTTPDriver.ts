import { Driver, Loading } from './type'
import { BehaviorSubject, Subject } from 'rxjs'
import { scan, shareReplay } from 'rxjs/operators'

let DRIVER = {}

export class IHTTP {
    loading$: Subject<Loading> = new BehaviorSubject({}).pipe(
        scan((acc, value) => Object.assign({}, acc, value)),
        shareReplay(1),
    ) as Subject<Loading>
    key: string = ''

    constructor() {
        Object.keys(DRIVER).forEach(method => {
            this[method] = function (...args: any[]) {
                const key = this.key
                key && this.loading$.next({ [key]: true })
                return DRIVER[method](...args).then((res: any) => {
                    key && this.loading$.next({ [key]: false })
                    return res
                })
            }
        })
    }

    withLoading(key: string) {
        this.key = key
        return this
    }

}


export default function applyHTTPDriver(driver: Driver) {
    Object.assign(DRIVER, driver)
}
