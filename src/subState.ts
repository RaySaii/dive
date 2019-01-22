import { ReplaySubject, Subject } from 'rxjs'
import {scan} from 'rxjs/operators'
import { SubState } from './type'

let subState$ = new ReplaySubject().pipe(
    scan((subs, newSub) => Object.assign({}, subs, newSub), {}),
)

export default subState$ as Subject<SubState>
