import React, { useState, useEffect } from "react";
import { useBalance } from "wagmi";

const BalanceDisplay = ({
  token,
  address,
  chainID,
  ethValue,
  setErrorInput,
  setCheckDisabled,
}) => {
  const dataToken = useBalance({
    address: address,
    token:
      chainID == process.env.REACT_APP_L1_CHAIN_ID
        ? token.l1Address
        : token.l2Address,
    watch: true,
    chainId: Number(chainID),
  });
  if (Number(dataToken.data?.formatted) < ethValue) {
    setErrorInput("Insufficient " + token.tokenSymbol + " balance.");
    setCheckDisabled(true);
  } else {
    setCheckDisabled(false);
    setErrorInput("");
  }
  return (
    <>
      {!!address && (
        <p className="wallet_bal mt-2">
          Balance: {Number(dataToken.data?.formatted).toFixed(5)}{" "}
          {token.tokenSymbol}
        </p>
      )}
    </>
  );
};

export default BalanceDisplay;
