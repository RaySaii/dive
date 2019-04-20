import {BehaviorSubject, Subject} from 'rxjs'
import {effectWith} from '../index'

describe('effectWith should work correctly', () => {

  it('effectWith will do some effect and return original value', async done => {
    let current
    let test
    let subject1 = new Subject()
    let subject2 = new BehaviorSubject(1)
    subject1.pipe(
        effectWith(subject2, (value1, value2) => {
          test = value2
          return value2
        }),
    ).subscribe(val => {
      current = val
    })
    subject1.next(2)
    expect(test).toEqual(1)
    expect(current).toEqual(2)
    done()
  })

})
