import React, { useState, useEffect } from "react";
import "../assets/style/deposit.scss";
import { Form, Spinner, Image } from "react-bootstrap";
import { Dai, Usdc, Usdt, Ethereum, Btc } from "react-web3-icons";
import toIcn from "../assets/images/logo.png";
import { IoMdWallet } from "react-icons/io";
import { FaEthereum } from "react-icons/fa";
import {
  useAccount,
  useConnect,
  useNetwork,
  useSwitchNetwork,
  useBalance,
  useToken,
} from "wagmi";
import { InjectedConnector } from "wagmi/connectors/injected";
import TabMenu from "./TabMenu";
import { HiSwitchHorizontal } from "react-icons/hi";
import metamask from "../assets/images/metamask.svg";
import Web3 from "web3";
import TOKEN_LIST from "../tokenlist";
import BalanceDisplay from "./BalanceDisplay";
const optimismSDK = require("@eth-optimism/sdk");
const ethers = require("ethers");

const Deposit = () => {
  const [ethValue, setEthValue] = useState("");
  const [sendToken, setSendToken] = useState("BNB");
  const { data: accountData, address, isConnected } = useAccount();
  const [errorInput, setErrorInput] = useState("");
  const [loader, setLoader] = useState(false);
  const { chain, chains } = useNetwork();
  const [checkMetaMask, setCheckMetaMask] = useState("");

  const { connect, connectors, error, isLoading, pendingConnector } =
    useConnect({
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
  const { switchNetwork } = useSwitchNetwork({
    throwForSwitchChainNotSupported: true,
    onError(error) {
      console.log("Error", error);
    },
    onMutate(args) {
      console.log("Mutate", args);
    },
    onSettled(data, error) {
      console.log("Settled", { data, error });
    },
    onSuccess(data) {
      console.log("Success", data);
    },
  });

  const { data } = useBalance({
    address: address,
    watch: true,
    chainId: Number(process.env.REACT_APP_L1_CHAIN_ID),
  });

  const handleSwitch = () => {
    switchNetwork(process.env.REACT_APP_L1_CHAIN_ID);
  };

  const handleDeposit = async () => {
    try {
      if (!ethValue) {
        setErrorInput("Please enter the amount");
      } else {
        if (!parseFloat(ethValue) > 0) {
          setErrorInput("Invalid Amount Entered!");
        } else {
          const l2Url = process.env.REACT_APP_L2_RPC_URL;
          const l1Provider = new ethers.providers.Web3Provider(window.ethereum);
          const l2Provider = new ethers.providers.JsonRpcProvider(l2Url, "any");
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
              l2Bridge: process.env.REACT_APP_L2_BRIDGE,
              Adapter: optimismSDK.StandardBridgeAdapter,
            },
            ETH: {
              l1Bridge: l1Contracts.L1StandardBridge,
              l2Bridge: process.env.REACT_APP_L2_BRIDGE,
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
          if (sendToken === "BNB") {
            const weiValue = parseInt(
              ethers.utils.parseEther(ethValue)._hex,
              16
            );
            setLoader(true);
            var depositETHEREUM = await crossChainMessenger.depositETH(
              weiValue.toString()
            );
            const receiptETH = await depositETHEREUM.wait();
            if (receiptETH) {
              setLoader(false);
              setEthValue("");
            }
          }
          if (sendToken != "BNB") {
            const token = TOKEN_LIST.find((t) => t.tokenSymbol == sendToken);
            var tokenValue = parseInt(
              ethers.utils.parseUnits(ethValue)._hex,
              token.decimalValue
            );
            setLoader(true);
            var depositTxn1 = await crossChainMessenger.approveERC20(
              token.l1Address,
              token.l2Address,
              tokenValue
            );
            await depositTxn1.wait();
            var receiptToken = await crossChainMessenger.depositERC20(
              token.l1Address,
              token.l2Address,
              tokenValue
            );
            var getReceiptToken = await receiptToken.wait();
            if (getReceiptToken) {
              setLoader(false);
              setEthValue("");
            }
          }
        }
      }
    } catch (error) {
      console.log(error);
      setLoader(false);
    }
  };
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

  return (
    <>
      <div className="bridge_wrap">
        <TabMenu />
        <section className="deposit_wrap">
          <div className="deposit_price_wrap">
            <div className="deposit_price_title">
              <p>From</p>
              <h5>
                <Image src="./token/BNB.svg" alt="To icn" fluid /> BSC
              </h5>
            </div>
            <div className="deposit_input_wrap">
              <Form>
                <div className="deposit_inner_input">
                  <Form.Control
                    type="number"
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
                      <option value={token.tokenSymbol}>
                        {token.tokenSymbol}
                      </option>
                    ))}
                  </Form.Select>
                </div>
                {
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
                }
              </Form>
            </div>
            {errorInput && <small className="text-danger">{errorInput}</small>}
            {sendToken == "BNB" ? (
              address && (
                <p className="wallet_bal mt-2">
                  Balance: {Number(data?.formatted).toFixed(5)} BNB
                </p>
              )
            ) : (
              <BalanceDisplay
                token={TOKEN_LIST.find((t) => t.tokenSymbol == sendToken)}
                address={address}
                chainID={process.env.REACT_APP_L1_CHAIN_ID}
                ethValue={ethValue}
                setErrorInput={setErrorInput}
                setCheckDisabled={setCheckDisabled}
              />
            )}
          </div>
          <div className="deposit_details_wrap">
            <div className="deposit_details">
              <p>To</p>
              <h5>
                <Image src={toIcn} alt="To icn" fluid /> opBNB
              </h5>
            </div>
            <div className="deposit_inner_details">
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
                {" "}
                You’ll receive: {ethValue ? ethValue : "0"} {sendToken}
              </p>
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
            ) : chain.id !== Number(process.env.REACT_APP_L1_CHAIN_ID) ? (
              <button className="btn deposit_btn" onClick={handleSwitch}>
                <HiSwitchHorizontal />
                Switch to BSC
              </button>
            ) : checkDisabled ? (
              <button className="btn deposit_btn" disabled={true}>
                Deposit
              </button>
            ) : (
              <button
                className="btn deposit_btn"
                onClick={handleDeposit}
                disabled={loader ? true : false}
              >
                {" "}
                {loader ? (
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                ) : (
                  "Deposit"
                )}{" "}
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  );
};

export default Deposit;
