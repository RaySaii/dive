import {xhr} from '../'
import {Subject} from 'rxjs'
import Sinon from 'sinon'

const timer = Sinon.useFakeTimers()
const timeToDelay = 2000
describe('xhr should work correctly', () => {

  it('xhr will produce two value once', async done => {
    let current
    let subject = new Subject()
    subject.pipe(
        xhr(params => Promise.resolve(params)),
    ).subscribe(val => {
      current = val
    })
    subject.next({ a: 1 })
    expect(current).toEqual([undefined, true])
    await timer.tick(timeToDelay)
    expect(current).toEqual([{ a: 1 }, false])
    subject.complete()
    done()
  })

})



