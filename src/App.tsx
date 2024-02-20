import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { calculateLockIntervals, estimateDatetimeFromBlock, estimateMillisecondsFromBlocks } from "./utils";
import humanizeDuration from "humanize-duration";

/* Types for global vars from /public/scripts */
interface Lock {
  address: string;
  locks: { satoshis: number; block: number }[];
}
interface Payer {
  walletAddress: string;
}
declare const lockstreamTx: (
  lock: Lock,
  payer: Payer
) => {
  bsvtx: any;
  utxos: {
    satoshis: number;
    script: string;
    txid: string;
    vout: number;
  }[];
};
declare const broadcast: any;
declare const setupWallet: any;
declare const restoreWallet: any;
declare const backupWallet: any;
declare const getWalletBalance: any;
declare const getBlock: any;
declare const clearUTXOs: any;
declare const unlockCoins: any;

export default function App() {
  const [connecting, setConnecting] = useState(false);
  const [connectedWalletAddress, setConnectedWalletAddress] = useState("");
  const [balance, setBalance] = useState(0);
  const [startingBlockDate, setStartingBlockDate] = useState<Date>();
  const [endingBlockDate, setEndingBlockDate] = useState<Date>();

  const [currentBlockCache, setCurrentBlockCache] = useState<number>();
  const fetchBlock = async () => {
    const block = await getBlock();
    setCurrentBlockCache(block);
  };
  useEffect(() => {
    fetchBlock();
    setTimeout(fetchBlock, 1000 * 60 * 10);
  }, []);

  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [unlocking, setUnlocking] = useState(false);
  const fileUploadRef = useRef<HTMLInputElement>(null);
  async function handleRestoreWallet() {
    if (fileUploadRef.current) {
      fileUploadRef.current.click();
    }
  }
  async function handleNewWallet() {
    setConnecting(true);
    try {
      await setupWallet();
      const addr = localStorage.getItem("walletAddress");
      if (typeof addr !== "string") {
        throw new Error("Error connecting wallet");
      }
      setConnectedWalletAddress(addr);
    } catch (e) {
      alert(e);
    }
    setConnecting(false);
  }
  async function handleDisconnect() {
    try {
      // eslint-disable-next-line no-restricted-globals
      const hasBackup = confirm("have you backed up your keys?");
      if (hasBackup) {
        localStorage.clear();
        setConnectedWalletAddress("");
        clearUTXOs();
      }
    } catch (e) {
      alert(e);
    }
  }
  async function refreshBalance() {
    setBalance(0);
    const sats = await getWalletBalance();
    const bsv = sats / 100_000_000;
    setBalance(bsv);
    return bsv;
  }
  const handleRefreshBalance = useCallback(refreshBalance, [setBalance]);
  useEffect(() => {
    if (connectedWalletAddress) {
      handleRefreshBalance();
    }
  }, [connectedWalletAddress, handleRefreshBalance]);

  useEffect(() => {
    const addr = localStorage.getItem("walletAddress")
    if (typeof addr === 'string') {
      setConnectedWalletAddress(addr);
    }
  }, [connectedWalletAddress]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (e) => {
    const formData = new FormData(e.currentTarget);
    e.preventDefault();
    try {
      setStatus("submitting");
      const currentBlockHeight = await getBlock();
      if (typeof currentBlockHeight !== "number")
        throw new Error("Error fetching current block height");
      const balance = await handleRefreshBalance();
      const bsv = Number(formData.get("bsv"));
      if (bsv > balance) {
        throw new Error("Insufficient balance");
      }
      const totalSats = parseInt((bsv * 100_000_000).toString(), 10);
      const startBlock = Number(formData.get("startBlock"));
      const endBlock = Number(formData.get("endBlock"));
      const bsvAddress = localStorage.getItem("walletAddress");
      if (!bsvAddress) {
        throw new Error("Error getting address.");
      }
      const blockInterval = Number(formData.get("blockInterval"));
      const locks = calculateLockIntervals({
        startBlock,
        endBlock,
        blockInterval,
        totalSats,
      });
      const lock: Lock = {
        address: bsvAddress,
        locks,
      };
      const payer: Payer = {
        walletAddress: bsvAddress,
      };
      if (locks.some(l => l.satoshis <= 1)) {
        throw new Error("Minimum lock is 2 satoshis per output")
      }
      if (
        window.confirm(
          `Lock ${(
            locks.reduce((prev, curr) => prev + curr.satoshis, 0) / 100_000_000
          )
            .toFixed(8)
            .toLocaleString()} BSV? ${
            locks.length
          } outputs will be created with ${(locks[0].satoshis / 100_000_000)
            .toFixed(8)
            .toLocaleString()} BSV unlockable every ${blockInterval.toLocaleString()} blocks starting at block ${locks[0].block.toLocaleString()} and ending at block ${locks[
            locks.length - 1
          ].block.toLocaleString()}.`
        )
      ) {
        const rawTx = await lockstreamTx(lock, payer);
        const t = await broadcast(rawTx);
        alert("successfully broadcasted tx " + t);
      }
    } catch (e) {
      console.error(e);
      alert(e);
    } finally {
      setStatus("idle");
    }
  };
  const handleUnlock: React.FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      setUnlocking(true);
      const txid = String(formData.get("txid"));
      const vout = Number(formData.get("vout"));
      const walletAddress = localStorage.getItem("walletAddress");
      const walletKey = localStorage.getItem("walletKey");
      if (window.confirm(`Confirm unlock of tx ${txid} vout ${vout}`)) {
        const rawTx = await unlockCoins(walletKey, walletAddress, txid, vout);
        const unlockResult = await broadcast(rawTx);
        alert(unlockResult);
      }
    } catch (e) {
      console.error(e);
      alert(e);
    } finally {
      setUnlocking(false);
    }
  };
  function handleChangeStartingBlock(e: ChangeEvent<HTMLInputElement>) {
    if (!currentBlockCache) return;
    setStartingBlockDate(
      estimateDatetimeFromBlock(currentBlockCache, Number(e.target.value))
    );
  }
  function handleChangeEndingBlock(e: ChangeEvent<HTMLInputElement>) {
    if (!currentBlockCache) return;
    setEndingBlockDate(
      estimateDatetimeFromBlock(currentBlockCache, Number(e.target.value))
    );
  }
  const [interval, setInterval] = useState<number>()
  function handleChangeInterval(e: ChangeEvent<HTMLInputElement>) {
    setInterval(Number(e.target.value))
  }

  return (
    <div>
      <h1 style={{ marginBottom: "2px" }}>
        Lockstream
        <div style={{ display: "inline-block", marginLeft: "12px" }}>
          <a href="https://github.com/remjx/lockstream">
            <img
              src={`${process.env.PUBLIC_URL}/github.png`}
              alt="source code"
              height={32}
              width={32}
            />
          </a>
        </div>
      </h1>
      <div>
        lock bitcoin into the future with a steady stream of unlockable outputs
      </div>
      <div style={{ marginBottom: "16px" }}>
        use this software at your own risk
      </div>

      {!connectedWalletAddress ? (
        <>
          <button
            disabled={connecting}
            onClick={handleNewWallet}
            style={{ marginRight: "8px" }}
          >
            new shua wallet
          </button>
          <button disabled={connecting} onClick={handleRestoreWallet}>
            restore shua wallet
          </button>
          <input
            ref={fileUploadRef}
            type="file"
            id="uploadFile"
            accept=".json"
            hidden
            onChange={(e: any) => {
              const files = e.target.files;
              const file = files[0];
              const reader = new FileReader();
              setConnecting(true);
              reader.onload = (e) => {
                try {
                  const json = JSON.parse(e?.target?.result as string);
                  restoreWallet(json.ordPk, json.payPk);
                  setConnectedWalletAddress(
                    String(localStorage.getItem("walletAddress"))
                  );
                } catch (e) {
                  console.log(e);
                  alert(e);
                  setConnectedWalletAddress("");
                  throw new Error("Error restoring wallet.");
                }
              };
              setConnecting(false);
              reader.readAsText(file);
            }}
          />
        </>
      ) : (
        <>
          <div>
            connected wallet address:{" "}
            <a
              href={`https://whatsonchain.com/address/${connectedWalletAddress}`}
              target="_blank"
              rel="noreferrer"
            >
              {connectedWalletAddress}
            </a>
          </div>
          <div style={{ marginBottom: "8px" }}>
            balance: {balance} BSV{" "}
            <button onClick={handleRefreshBalance}>refresh balance</button>
          </div>
          <button
            disabled={connecting}
            onClick={handleDisconnect}
            style={{ marginRight: "8px" }}
          >
            disconnect wallet
          </button>
          <button disabled={connecting} onClick={backupWallet}>
            back up wallet
          </button>
          <br />
          <br />
          <form onSubmit={handleSubmit}>
            <div>
              <label>lock amount (bsv): </label>
              <input name="bsv" min={0} disabled={status === "submitting"} />
            </div>
            <div>
              <label>starting block: </label>
              <input
                type="number"
                name="startBlock"
                disabled={status === "submitting"}
                onChange={handleChangeStartingBlock}
              />
              <span>{startingBlockDate ? ` ~ ${startingBlockDate?.toLocaleString()}` : ""}</span>
            </div>
            <div>
              <label>ending block: </label>
              <input
                type="number"
                name="endBlock"
                disabled={status === "submitting"}
                onChange={handleChangeEndingBlock}
              />
              <span>{endingBlockDate ? ` ~ ${endingBlockDate?.toLocaleString()}` : ""}</span>
            </div>
            <div>
              <label>unlock interval (blocks): </label>
              <input
                type="number"
                name="blockInterval"
                min={1}
                disabled={status === "submitting"}
                onChange={handleChangeInterval}
              />
              <span>{interval ? ` ~ ${humanizeDuration(estimateMillisecondsFromBlocks(interval))}` : ""}</span>
            </div>
            <br />
            <button disabled={status === "submitting"}>
              {status === "submitting" ? "submitting" : "submit"}
            </button>
          </form>
          <br />
          <br />
          <div>unlock:</div>
          <form onSubmit={handleUnlock}>
            <input
              placeholder="txid"
              name="txid"
              type="text"
              disabled={unlocking}
            />
            <input
              placeholder="vout"
              name="vout"
              type="text"
              disabled={unlocking}
            />
            <button type="submit" disabled={unlocking}>
              unlock
            </button>
          </form>
          <br />
        </>
      )}
    </div>
  );
}
