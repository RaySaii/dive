import {wait, waitWith} from '../'
import {BehaviorSubject, Subject} from 'rxjs'
import Sinon from 'sinon'

const timer = Sinon.useFakeTimers()
const timeToDelay = 2000
describe('xhr should work correctly', () => {

  it('wait can handle normal value', async done => {
    let current
    let subject = new Subject()
    subject.pipe(
        wait(val => val),
    ).subscribe(val => {
      current = val
    })
    subject.next({ a: 1 })
    expect(current).toEqual({ a: 1 })
    subject.complete()
    done()
  })

  it('wait can handle with others observable1', async done => {
    let current
    let subject = new Subject()
    let subject1 = new BehaviorSubject(2)
    subject.pipe(
        waitWith(subject1, (val, val1) => val + val1),
    ).subscribe(val => {
      current = val
    })
    subject.next(1)
    expect(current).toEqual(3)
    subject.complete()
    done()
  })

  it('wait can handle with others observable2', async done => {
    let current
    let subject = new Subject()
    let subject1 = new BehaviorSubject(2)
    subject.pipe(
        waitWith(subject1, (val, val1) => Promise.resolve(val + val1)),
    ).subscribe(val => {
      current = val
    })
    subject.next(1)
    await timer.tick(timeToDelay)
    expect(current).toEqual(3)
    subject.complete()
    done()
  })

})



