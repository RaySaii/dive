import {pickByKey} from '../'
import {Subject} from 'rxjs'


describe('pickByKey should work correctly', () => {

  it('object will pick by key', done => {
    let current
    let subject = new Subject()
    subject.pipe(
        pickByKey('a', 'b'),
    ).subscribe(val => current = val)
    subject.next({ a: 1, b: 1, c: 2 })
    subject.complete()
    expect(current).toEqual({ a: 1, b: 1 })
    done()
  })

})



