type Lock = { satoshis: number, block: number }
  export function calculateLockIntervals({
    totalSats,
    startBlock,
    endBlock,
    blockInterval,
} : {
    totalSats: number
    startBlock: number
    endBlock: number
    blockInterval: number
}): Lock[] {
    const blocks = endBlock - startBlock
    const numIntervals = Math.floor(blocks / blockInterval)
    if (!blockInterval || blockInterval > blocks || blockInterval <= 0) throw new Error("invalid interval")
    const satsPerInterval = Math.floor(Number((totalSats / numIntervals).toFixed(8)))
    const locks: Lock[] = []
    for (let i = 1; i <= numIntervals; i++) {
        locks.push({
            block: startBlock + i * blockInterval,
            satoshis: satsPerInterval
        })
    }
    console.log('locks', locks)
    return locks;
}

export function estimateDatetimeFromBlock(currentBlock: number, futureBlock: number) {
    const blocks = futureBlock - currentBlock
    const duration = blocks * 1000 * 60 * 10
    return new Date(new Date().valueOf() + duration)
}

export function estimateMillisecondsFromBlocks(blocks: number): number {
    return blocks * 1000 * 60 * 10
}
// function estimateBitcoinBlocks(endDate: Date) {
//     const now = new Date();
//     const diffInMs = endDate.valueOf() - now.valueOf();
//     const diffInMinutes = diffInMs / 1000 / 60;
//     const averageBlockTime = 10;
//     const estimatedBlocks = diffInMinutes / averageBlockTime;
//     return Math.round(estimatedBlocks);
// }
// function convertToBlockTime() {

// const BLOCKS_PER_DAY = 144
//     let differenceInTime = endDate.getTime() - startDate.getTime();
//     let differenceInDays = differenceInTime / (1000 * 3600 * 24);
//     if (intervalDays > differenceInDays) throw new Error("Interval less than duration");
// }

export function downloadObjectAsJson(data: Object, fileName: string) {
    const jsonString = JSON.stringify(data);
    const file = new File([jsonString], fileName, {
        type: "application/json",
    });
    const a = document.createElement("a");
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url); // Clean up to avoid memory leaks
}

export function readFileAsync(file: File) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = () => {
            reader.abort();
            reject(new DOMException("Error parsing input file."));
        };
        reader.readAsText(file);
    });
}