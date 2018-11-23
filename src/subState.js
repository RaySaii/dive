import {ReplaySubject, Subject} from 'rxjs'
import {scan, shareReplay} from 'rxjs/operators'

let subState$ = new ReplaySubject().pipe(
    scan((subs, newSub) => Object.assign({}, subs, newSub), {}),
)

export default subState$
