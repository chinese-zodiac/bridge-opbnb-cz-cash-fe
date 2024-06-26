import React, { useEffect, useState } from "react";
import "../assets/style/deposit.scss";
import "../assets/style/withdraw.scss";
import { Form, Image, Spinner } from "react-bootstrap";
import { MdOutlineSecurity } from "react-icons/md";
import toIcn from "../assets/images/logo.png";
import {
  useAccount,
  useConnect,
  useNetwork,
  useSwitchNetwork,
  useBalance,
} from "wagmi";
import { InjectedConnector } from "wagmi/connectors/injected";
import { IoMdWallet } from "react-icons/io";
import { HiSwitchHorizontal } from "react-icons/hi";
import metamask from "../assets/images/metamask.svg";
import TabMenu from "./TabMenu";
import TOKEN_LIST from "../tokenlist";
import BalanceDisplay from "./BalanceDisplay";
import { parseUnits } from "viem";
const optimismSDK = require("@eth-optimism/sdk");
const ethers = require("ethers");
const Withdraw = () => {
  const [ethValue, setEthValue] = useState("");
  const [sendToken, setSendToken] = useState("BNB");
  const [errorInput, setErrorInput] = useState("");
  const [checkMetaMask, setCheckMetaMask] = useState("");
  const [loader, setLoader] = useState(false);
  const { address, isConnected } = useAccount();
  const { chain, chains } = useNetwork();
  const [RaceBalance, setRaceBalance] = useState(0);
  const { connect } = useConnect({
    connector: new InjectedConnector({ chains }),
    onError(error) {
      console.log("Error", error);
    },
    onMutate(args) {
      console.log("Mutate", args);
      if (args.connector.ready === true) {
        setCheckMetaMask(false);
      } else {
        setCheckMetaMask(true);
      }
    },
    onSettled(data, error) {
      console.log("Settled", { data, error });
    },
    onSuccess(data) {
      console.log("Success", data);
    },
  });
  const [metaMastError, setMetaMaskError] = useState("");
  const { error, isLoading, pendingChainId, switchNetwork } = useSwitchNetwork({
    // throwForSwitchChainNotSupported: true,
    chainId: 90001,
    onError(error) {
      console.log("Error", error);
    },
    onMutate(args) {
      console.log("Mutate", args);
    },
    onSettled(data, error) {
      console.log("Settled", { data, error });
      try {
        window.ethereum
          .request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: (function (dec) {
                  return `0x${parseInt(dec, 10).toString(16)}`;
                })(process.env.REACT_APP_L2_CHAIN_ID),
                rpcUrls: [process.env.REACT_APP_L2_RPC_URL],
                chainName: process.env.REACT_APP_L2_NETWORK_NAME,
                nativeCurrency: {
                  name: "BNB",
                  symbol: "BNB",
                  decimals: 18,
                },
                blockExplorerUrls: [process.env.REACT_APP_L2_EXPLORER_URL],
              },
            ],
          })
          .then((data) => {
            setMetaMaskError("");
          })
          .catch((err) => {
            if (err.code === -32002) {
              setMetaMaskError("Request stuck in pending state");
            }
          });
      } catch (error) {
        console.log(error);
      }
    },
    onSuccess(data) {
      console.log("Success", data);
    },
  });
  //========================================================== BALANCES =======================================================================

  const { data } = useBalance({
    address: address,
    chainId: Number(process.env.REACT_APP_L2_CHAIN_ID),
    watch: true,
  });

  ////========================================================== WITHDRAW =======================================================================

  const handleWithdraw = async () => {
    try {
      if (!ethValue) {
        setErrorInput("Please enter the amount");
      } else {
        if (!parseFloat(ethValue) > 0) {
          setErrorInput("Invalid Amount Entered!");
        } else {
          setErrorInput("");
          const l1Url = process.env.REACT_APP_L1_RPC_URL;
          const l1Provider = new ethers.providers.JsonRpcProvider(l1Url, "any");
          const l2Provider = new ethers.providers.Web3Provider(window.ethereum);
          const l1Signer = l1Provider.getSigner(address);
          const l2Signer = l2Provider.getSigner(address);
          const zeroAddr = "0x".padEnd(42, "0");
          const l1Contracts = {
            StateCommitmentChain: zeroAddr,
            CanonicalTransactionChain: zeroAddr,
            BondManager: zeroAddr,
            AddressManager: process.env.REACT_APP_ADDRESS_MANAGER,
            L1CrossDomainMessenger:
              process.env.REACT_APP_L1_CROSS_DOMAIN_MESSANGER_PROXY,
            L1StandardBridge: process.env.REACT_APP_L1_STANDARD_BRIDGE_PROXY,
            OptimismPortal: process.env.REACT_APP_OPTIMISM_PORTAL_PROXY,
            L2OutputOracle: process.env.REACT_APP_L2_OUTPUT_ORACLE_PROXY,
          };
          const bridges = {
            Standard: {
              l1Bridge: l1Contracts.L1StandardBridge,
              l2Bridge: "0x4200000000000000000000000000000000000010",
              Adapter: optimismSDK.StandardBridgeAdapter,
            },
            ETH: {
              l1Bridge: l1Contracts.L1StandardBridge,
              l2Bridge: "0x4200000000000000000000000000000000000010",
              Adapter: optimismSDK.ETHBridgeAdapter,
            },
          };
          const crossChainMessenger = new optimismSDK.CrossChainMessenger({
            contracts: {
              l1: l1Contracts,
            },
            bridges: bridges,
            l1ChainId: Number(process.env.REACT_APP_L1_CHAIN_ID),
            l2ChainId: Number(process.env.REACT_APP_L2_CHAIN_ID),
            l1SignerOrProvider: l1Signer,
            l2SignerOrProvider: l2Signer,
            bedrock: true,
          });
          //-------------------------------------------------------- SEND TOKEN VALUE -----------------------------------------------------------------

          try {
            if (sendToken === "BNB") {
              const weiValue = parseInt(
                ethers.utils.parseEther(ethValue)._hex,
                16
              );
              setLoader(true);
              const response = await crossChainMessenger.withdrawETH(
                weiValue.toString()
              );
              const logs = await response.wait();
              if (logs) {
                setLoader(false);
                setEthValue("");
              }
            }

            if (sendToken != "BNB") {
              const token = TOKEN_LIST.find((t) => t.tokenSymbol == sendToken);
              var tokenValue = parseUnits(ethValue, Number(token.decimalValue));
              setLoader(true);
              var receiptToken = await crossChainMessenger.withdrawERC20(
                token.l1Address,
                token.l2Address,
                tokenValue.toString()
              );
              var getReceiptToken = await receiptToken.wait();
              if (getReceiptToken) {
                setLoader(false);
                setEthValue("");
              }
            }
            //-------------------------------------------------------- SEND TOKEN VALUE END-----------------------------------------------------------------
            updateWallet();
          } catch (error) {
            setLoader(false);
            console.log({ error }, 98);
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleSwitch = () => {
    try {
      switchNetwork(process.env.REACT_APP_L2_CHAIN_ID);
    } catch (error) {
      console.log(error);
    }
  };
  ////========================================================== HANDLE CHANGE =======================================================================
  const [checkDisabled, setCheckDisabled] = useState(false);

  const handleChange = (e) => {
    if (sendToken == "BNB") {
      if (Number(data?.formatted) < e.target.value) {
        setErrorInput("Insufficient " + sendToken + " balance.");
        setCheckDisabled(true);
      } else {
        setCheckDisabled(false);
        setErrorInput("");
      }
    }
    setEthValue(e.target.value);
  };

  // ============= For Format balance =========================
  const formatBalance = (rawBalance) => {
    const balance = (parseInt(rawBalance) / 1000000000000000000).toFixed(6);
    return balance;
  };
  // ============= Get and update balance =========================
  const updateWallet = async () => {
    const balance = formatBalance(
      await window.ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      })
    );
    setRaceBalance(balance);
  };

  useEffect(() => {
    updateWallet();
  }, [data]);
  return (
    <>
      <div className="bridge_wrap">
        <TabMenu />
        <section className="deposit_wrap">
          <div className="withdraw_title_wrap">
            <div className="withdraw_title_icn">
              <MdOutlineSecurity />
            </div>
            <div className="withdraw_title_content">
              <h3>USES OPTIMISM BRIDING</h3>
              <p>This takes a minimum of 7 days.</p>
              <p>
                After you withdraw, wait 5 minutes and go to "proofs" to check
                the status.
              </p>
            </div>
          </div>
          <div className="deposit_price_wrap">
            <div className="deposit_price_title">
              <p>From</p>
              <h5>
                <Image src={toIcn} alt="To icn" fluid /> opBNB
              </h5>
            </div>
            <div className="deposit_input_wrap">
              <Form>
                <div className="deposit_inner_input">
                  <Form.Control
                    type="number"
                    name="eth_value"
                    value={ethValue}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                    step="any"
                  />
                  <Form.Select
                    aria-label="Default select example"
                    className="select_wrap"
                    onChange={({ target }) => setSendToken(target.value)}
                  >
                    <option>BNB</option>
                    {TOKEN_LIST.map((token) => (
                      <option key={token.tokenSymbol} value={token.tokenSymbol}>
                        {token.tokenSymbol}
                      </option>
                    ))}
                  </Form.Select>
                </div>
                <div className="input_icn_wrap">
                  {sendToken == "BNB" ? (
                    <span className="input_icn">
                      <Image src="./token/BNB.svg" alt="To icn" fluid />
                    </span>
                  ) : (
                    <span className="input_icn">
                      <Image
                        src={
                          "./token/" +
                          TOKEN_LIST.find((t) => t.tokenSymbol == sendToken)
                            .logo
                        }
                        alt="To icn"
                        fluid
                      />
                    </span>
                  )}
                </div>
              </Form>
            </div>
            {errorInput && <small className="text-danger">{errorInput}</small>}
            {sendToken === "BNB" ? (
              address && (
                <p className="wallet_bal mt-2">
                  Balance: {Number(data?.formatted).toFixed(5)} BNB
                </p>
              )
            ) : (
              <BalanceDisplay
                token={TOKEN_LIST.find((t) => t.tokenSymbol == sendToken)}
                address={address}
                chainID={process.env.REACT_APP_L2_CHAIN_ID}
                ethValue={ethValue}
                setErrorInput={setErrorInput}
                setCheckDisabled={setCheckDisabled}
              />
            )}
          </div>
          <div className="deposit_details_wrap">
            <div className="deposit_details">
              <p>To:</p>
              <h5>
                <Image src="./token/BNB.svg" alt="To icn" fluid /> BSC
              </h5>
            </div>
            <div className="withdraw_bal_sum">
              {sendToken == "BNB" ? (
                <span className="input_icn">
                  {" "}
                  <Image src="./token/BNB.svg" alt="To icn" fluid />
                </span>
              ) : (
                <span className="input_icn">
                  {" "}
                  <Image
                    src={
                      "./token/" +
                      TOKEN_LIST.find((t) => t.tokenSymbol == sendToken).logo
                    }
                    fluid
                  />
                </span>
              )}{" "}
              <p>
                You’ll receive: {ethValue ? ethValue : "0"} {sendToken}
              </p>
              <div></div>
              {/* <span className='input_title'>ETH</span> */}
            </div>
          </div>
          <div className="deposit_btn_wrap">
            {checkMetaMask === true ? (
              <a
                className="btn deposit_btn"
                href="https://metamask.io/"
                target="_blank"
              >
                <Image src={metamask} alt="metamask icn" fluid /> Please Install
                Metamask Wallet
              </a>
            ) : !isConnected ? (
              <button className="btn deposit_btn" onClick={() => connect()}>
                <IoMdWallet />
                Connect Wallet
              </button>
            ) : chain.id !== Number(process.env.REACT_APP_L2_CHAIN_ID) ? (
              <button className="btn deposit_btn" onClick={handleSwitch}>
                <HiSwitchHorizontal />
                Switch to opBNB
              </button>
            ) : checkDisabled ? (
              <button className="btn deposit_btn" disabled={true}>
                Withdraw
              </button>
            ) : (
              <button
                className="btn deposit_btn"
                onClick={handleWithdraw}
                disabled={loader ? true : false}
              >
                {loader ? (
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                ) : (
                  "Withdraw"
                )}
              </button>
            )}

            <p className="white">
              AFTER WITHDRAW, GO TO "PROOFS" AND COMPLETE THE PROOFS TO RECEIVE
              TOKENS ON BSC.
            </p>
          </div>
          {metaMastError && (
            <small className="d-block text-danger text-center mt-2">
              {metaMastError}
            </small>
          )}
        </section>
      </div>
    </>
  );
};

export default Withdraw;
