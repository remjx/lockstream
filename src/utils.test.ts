import { calculateLockIntervals } from './utils'

describe("calculateLockIntervals", () => {
    test("unlocks 1x 100sats over 10 blocks", () => {
        const params = {
            totalSats: 100,
            startBlock: 100_000,
            endBlock: 100_009,
            blockInterval: 8,
        }
        const result = calculateLockIntervals(params)
        expect(result.length).toBe(1)
        expect(result.every(lock => lock.satoshis === 100)).toBe(true)
    })
    test("unlocks 2x 50sats over 10 blocks", () => {
        const params = {
            totalSats: 100,
            startBlock: 100_000,
            endBlock: 100_009,
            blockInterval: 4,
        }
        const result = calculateLockIntervals(params)
        expect(result.length).toBe(2)
        expect(result.every(lock => lock.satoshis === 50)).toBe(true)
    })
    test("more intervals than blocks", () => {
        expect(() => calculateLockIntervals({
            totalSats: 10,
            startBlock: 100_000,
            endBlock: 100_009,
            blockInterval: 10,
        })).toThrowError("invalid interval")
    })
})