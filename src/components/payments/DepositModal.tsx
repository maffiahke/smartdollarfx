"use client";

import { useState, useEffect, useRef } from "react";
import { X, Smartphone, Bitcoin, Copy, Check, Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

type Tab = "mpesa" | "crypto";
type DepositState = "form" | "waiting" | "success" | "error";

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (balance: number) => void;
  userPhone?: string | null;
}

interface CryptoResult {
  address: string;
  amount: number;
  reference: string;
  transactionId: string;
  status: string;
  message?: string;
}

export function DepositModal({ open, onClose, onSuccess, userPhone }: DepositModalProps) {
  const [tab, setTab] = useState<Tab>("mpesa");
  const [amount, setAmount] = useState(5);
  const [phone, setPhone] = useState(userPhone ?? "");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cryptoResult, setCryptoResult] = useState<CryptoResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [kesRate, setKesRate] = useState<number | null>(null);
  const [limits, setLimits] = useState({ minDeposit: 5, maxDeposit: 10000 });
  const [depositState, setDepositState] = useState<DepositState>("form");
  const [depositAmount, setDepositAmount] = useState(0);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [statusText, setStatusText] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const MIN_DEPOSIT = limits.minDeposit;

  // Clean up poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Fetch USD → KES conversion rate and deposit limits
  useEffect(() => {
    fetch("/api/payments/rate")
      .then((r) => r.json())
      .then((d) => setKesRate(d.usdToKes))
      .catch(() => {});
    fetch("/api/payments/deposit")
      .then((r) => r.json())
      .then((d) => {
        if (d.limits) setLimits({ minDeposit: d.limits.minDeposit, maxDeposit: d.limits.maxDeposit });
      })
      .catch(() => {});
  }, []);

  if (!open) return null;

  const reset = () => {
    setError("");
    setCryptoResult(null);
    setTxHash("");
    setDepositState("form");
    setNewBalance(null);
    setStatusText("");
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const pollDepositStatus = (transactionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status/${transactionId}`);
        const data = await res.json();

        if (data.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setNewBalance(data.balance ?? null);
          setDepositState("success");
          setStatusText("");
          return;
        }

        if (data.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setError("Payment failed or was cancelled. Please try again.");
          setStatusText("");
          setDepositState("error");
          return;
        }

        // Still pending — update status text with a simple animation
        const dots = ".".repeat((Math.floor(Date.now() / 1500) % 3) + 1);
        setStatusText(`Waiting for confirmation${dots}`);
      } catch {
        // network hiccup — keep polling
      }
    }, 3000);
  };

  const handleDeposit = async () => {
    setLoading(true);
    setError("");
    setDepositAmount(amount);
    setDepositState("waiting");
    setStatusText("Sending payment request...");
    try {
      const res = await fetch("/api/payments/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: tab,
          amount,
          phone: tab === "mpesa" ? phone : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const raw = data.error ?? data.message ?? data;
        throw new Error(typeof raw === "string" ? raw : JSON.stringify(raw));
      }

      if (tab === "mpesa") {
        setStatusText("Check your phone for the M-Pesa prompt and enter your PIN");
        if (data.transactionId) {
          pollDepositStatus(data.transactionId);
        }
      } else {
        setCryptoResult(data);
        if (data.status === "completed" && data.balance != null) {
          setNewBalance(data.balance);
          setDepositState("success");
        } else {
          // Crypto — show the address, user is still on the "form"
          setDepositState("form");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
      setStatusText("");
      setDepositState("error");
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessDone = () => {
    if (newBalance !== null) onSuccess(newBalance);
    reset();
    onClose();
  };

  const confirmCrypto = async () => {
    if (!cryptoResult) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/payments/crypto/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: cryptoResult.transactionId,
          txHash,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Confirmation failed");
      setNewBalance(data.balance);
      setDepositState("success");
      setCryptoResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: { id: Tab; label: string; icon: typeof Smartphone }[] = [
    { id: "mpesa", label: "M-Pesa", icon: Smartphone },
    { id: "crypto", label: "USDT", icon: Bitcoin },
  ];

  // ── Waiting Modal Overlay ──
  if (depositState === "waiting") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm bg-[#1c2030] border border-white/[0.07] rounded-3xl overflow-hidden shadow-2xl text-center">
          <div className="px-6 pt-10 pb-8 space-y-5">
            <div className="w-20 h-20 mx-auto relative">
              <div className="absolute inset-0 rounded-full border-[3px] border-[#833ab4]/20" />
              <div className="absolute inset-0 rounded-full border-[3px] border-t-[#833ab4] border-r-[#d90000] border-b-transparent border-l-transparent animate-spin" />
              <div className="absolute inset-2 rounded-full bg-[#833ab4]/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#833ab4] animate-pulse" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Processing Payment</h3>
              <p className="text-3xl font-extrabold mt-2 text-gradient-brand">
                ${depositAmount.toFixed(2)}
              </p>
              {kesRate && (
                <p className="text-sm text-gray-500 mt-1 tabular-nums">
                  ≈ KES {(depositAmount * kesRate).toLocaleString("en-US")}
                </p>
              )}
            </div>
            <div className="bg-[#13161e] rounded-xl px-4 py-3">
              <p className="text-sm text-gray-300">{statusText}</p>
            </div>
            <p className="text-xs text-gray-500">
              Please complete the payment on your phone. Do not close this screen.
            </p>
            <button
              onClick={() => { if (pollRef.current) clearInterval(pollRef.current); reset(); }}
              className="text-sm text-gray-400 hover:text-white underline underline-offset-2"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success Modal Overlay ──
  if (depositState === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm bg-[#1c2030] border border-white/[0.07] rounded-3xl overflow-hidden shadow-2xl text-center">
          <div className="bg-emerald-500/10 px-6 pt-10 pb-7">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-emerald-400">Deposit Successful!</h3>
            <p className="text-4xl font-extrabold text-white mt-3 tabular-nums">
              ${depositAmount.toFixed(2)}
            </p>
            {kesRate && (
              <p className="text-sm text-gray-400 mt-1 tabular-nums">
                ≈ KES {(depositAmount * kesRate).toLocaleString("en-US")}
              </p>
            )}
          </div>
          <div className="px-5 py-5 space-y-4">
            {newBalance !== null && (
              <div className="flex items-center justify-between bg-white/[0.03] rounded-xl px-4 py-3.5">
                <span className="text-sm text-gray-400">New Balance</span>
                <span className="text-lg font-bold text-white tabular-nums">
                  ${newBalance.toFixed(2)}
                </span>
              </div>
            )}
            <button
              onClick={handleSuccessDone}
              className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition flex items-center justify-center gap-2"
            >
              Done <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Error Modal Overlay ──
  if (depositState === "error") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm bg-[#1c2030] border border-white/[0.07] rounded-3xl overflow-hidden shadow-2xl text-center">
          <div className="px-6 pt-10 pb-7">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-rose-500/15 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-rose-400" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-rose-400">Deposit Failed</h3>
            <p className="text-sm text-gray-300 mt-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
              {error || "Something went wrong. Please try again."}
            </p>
          </div>
          <div className="px-5 pb-5 flex gap-3">
            <button
              onClick={() => reset()}
              className="flex-1 h-12 rounded-xl bg-[#833ab4] hover:bg-[#6d2d9e] text-white font-bold text-sm transition"
            >
              Try Again
            </button>
            <button
              onClick={() => { reset(); onClose(); }}
              className="flex-1 h-12 rounded-xl border border-white/[0.1] hover:bg-white/5 text-gray-300 font-bold text-sm transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Deposit Form (default state) ──
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm safe-x">
      <div className="w-full sm:max-w-md max-h-[92dvh] sm:max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/[0.07] bg-[#1c2030] shadow-2xl safe-bottom">
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-white/[0.07] shrink-0">
          <h2 className="text-lg font-bold text-white">Deposit Funds</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-white/[0.07]">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); reset(); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition ${
                tab === id
                  ? "text-gradient-brand border-b-2 border-[#833ab4]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto overscroll-contain flex-1">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Amount (USD) <span className="text-gray-600">· ${MIN_DEPOSIT} – ${limits.maxDeposit}</span>
            </label>
            <input
              type="number"
              min={MIN_DEPOSIT}
              max={limits.maxDeposit}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-[#13161e] border border-white/[0.07] text-white text-sm focus:outline-none focus:border-[#833ab4]/50"
            />
            <div className="flex gap-1.5 mt-2">
              {[10, 25, 50, 100, 200].map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(v)}
                  className={`flex-1 py-1 rounded text-[10px] font-medium border transition ${
                    amount === v
                      ? "bg-[#2a1a3f] border-[#833ab4] text-[#c084fc]"
                      : "bg-[#13161e] text-gray-400 border-white/[0.07] hover:bg-white/5"
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>
            {kesRate && (
              <p className="text-[11px] text-gray-500 mt-2 text-right tabular-nums">
                ≈ KES {(amount * kesRate).toLocaleString("en-US")}
              </p>
            )}
          </div>

          {tab === "mpesa" && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                M-Pesa Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XX XXX XXX"
                className="w-full px-4 py-3 rounded-xl bg-[#13161e] border border-white/[0.07] text-white text-sm focus:outline-none focus:border-[#833ab4]/50"
              />
              <p className="text-[10px] text-gray-500 mt-1.5">
                You&apos;ll receive an STK push to complete payment
              </p>
            </div>
          )}

          {tab === "crypto" && cryptoResult && cryptoResult.status === "pending" && (
            <div className="rounded-xl bg-[#13161e] border border-white/[0.07] p-4 space-y-3">
              <p className="text-xs text-gray-400">
                Send <span className="text-white font-bold">${cryptoResult.amount} USDT</span> via
                TRC20 to:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[10px] text-emerald-400 break-all">
                  {cryptoResult.address}
                </code>
                <button
                  onClick={() => copyAddress(cryptoResult.address)}
                  className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-500">Ref: {cryptoResult.reference}</p>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Paste transaction hash"
                className="w-full px-3 py-2 rounded-lg bg-[#1c2030] border border-white/[0.07] text-white text-xs"
              />
              <button
                onClick={confirmCrypto}
                disabled={loading || txHash.length < 10}
                className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 bg-gradient-brand"
              >
                Confirm Payment
              </button>
            </div>
          )}

          {!cryptoResult && (
            <button
              onClick={handleDeposit}
              disabled={loading || amount < MIN_DEPOSIT}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
              style={{ background: "linear-gradient(90deg, rgba(131,58,180,1) 0%, rgba(217,0,0,1) 50%, rgba(194,252,69,1) 100%)" }}
            >
              {loading ? "Processing..." : `Deposit $${amount}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}