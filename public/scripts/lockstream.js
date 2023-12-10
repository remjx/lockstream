
const lockstreamTx = async(
    { address, locks }, // lock
    { walletAddress } // payer
) => {
    const bsvtx = bsv.Transaction();

    // build lock output
    if (!locks.length) throw new Error("No locks")
    locks.forEach(lock => {
        const { satoshis, block } = lock;
        if (!satoshis || !block) throw new Error("Invalid lock")
        const p2pkhOut = new bsv.Transaction.Output({script: bsv.Script(new bsv.Address(address)), satoshis: 1});
        const addressHex = p2pkhOut.script.chunks[2].buf.toString('hex');
        const nLockTimeHexHeight = int2Hex(block);
        const scriptTemplate = `${LOCKUP_PREFIX} ${addressHex} ${nLockTimeHexHeight} ${LOCKUP_SUFFIX}`;
        const lockingScript = bsv.Script.fromASM(scriptTemplate);
        const lockOutput = new bsv.Transaction.Output({script: lockingScript, satoshis })
        bsvtx.addOutput(lockOutput);
    })

    // pay
    const satoshis = bsvtx.outputs.reduce(((t, e) => t + e._satoshis), 0);
    const txFee = parseInt(((bsvtx._estimateSize() + P2PKH_INPUT_SIZE) * FEE_FACTOR)) + 1;
    const utxos = await getPaymentUTXOs(walletAddress, satoshis + txFee);
    if (!utxos.length) { throw `Insufficient funds` }
    bsvtx.from(utxos);
    const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
    bsvtx.to(walletAddress, inputSatoshis - satoshis - txFee);

    bsvtx.sign(bsv.PrivateKey.fromWIF(localStorage.walletKey));
    return bsvtx.toString();
}