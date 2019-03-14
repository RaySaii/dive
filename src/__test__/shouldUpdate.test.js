import {shouldUpdate} from '../'
import {EMPTY, of, combineLatest, merge, Subject} from 'rxjs'


describe('shouldUpdate should work correctly', () => {

  it('first value will always be passed', done => {
    let current
    let subject = new Subject()
    subject.pipe(
        shouldUpdate((a, b) => a != b),
    ).subscribe(val => current = val)
    subject.next(1)
    subject.complete()
    expect(current).toEqual(1)
    done()
  })

  it('compare will work correctly', done => {
    let current
    let subject = new Subject()
    subject.pipe(
        shouldUpdate((prev, cur) => prev.a!= cur.a),
    ).subscribe(val => current = val)
    subject.next({a:1,b:1})
    expect(current).toEqual({a:1,b:1})

    subject.next({a:1,b:2})
    expect(current).toEqual({a:1,b:1})

    subject.next({a:2,b:1})
    expect(current).toEqual({a:2,b:1})

    subject.next({a:2,b:2})
    expect(current).toEqual({a:2,b:1})

    subject.complete()
    done()
  })
})



