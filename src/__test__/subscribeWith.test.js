import {BehaviorSubject, Observable, Subject} from 'rxjs'
import {_subscribeWith} from '../utils'

Observable.prototype.subscribeWith = _subscribeWith

describe('subscribeWith should work correctly', () => {

  it('subscribeWith can handle with others observable', done => {
    let current
    let subject = new Subject()
    let subject1 = new BehaviorSubject(1)
    subject.subscribeWith(subject1, (val, val1) => current = val + val1)
    subject.next(1)
    subject.complete()
    expect(current).toEqual(2)
    done()
  })

})



