import React, { useEffect, useState } from "react";
import { Table, Spinner, Container } from "react-bootstrap";
import { useAccount, useNetwork, useSwitchNetwork } from "wagmi";
import { ethers } from "ethers";
import ReactPaginate from "react-paginate";
import Account from "./Account";
import TOKEN_LIST from "../../tokenlist";
import {
  decodeVersionedNonce,
  encodeCrossDomainMessageV0,
  encodeCrossDomainMessageV1,
  encodeVersionedNonce,
  getChainId,
  hashCrossDomainMessagev0,
  hashCrossDomainMessagev1,
  remove0x,
  sleep,
  toHexString,
  toRpcHexString,
} from "@eth-optimism/core-utils";
const optimismSDK = require("@eth-optimism/sdk");
const WithdrawAccount = () => {
  const [transactionLoader, setTransactionLoader] = useState(false);
  const [loader, setLoader] = useState();
  const { address, isConnected } = useAccount();
  const [withdrawDetails, setWithdrawDetails] = useState([]);
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork();
  const { blocksScanned, setBlocksScanned } = useState(0);
  const getCrossChain = async () => {
    const l2Url = String(process.env.REACT_APP_L2_RPC_URL);
    const l1Provider = new ethers.providers.Web3Provider(window.ethereum);
    const l2Provider = new ethers.providers.JsonRpcProvider(l2Url);
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
      OptimismPortal2: process.env.REACT_APP_OPTIMISM_PORTAL_PROXY,
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

    return crossChainMessenger;
  };
  const getWithdraw = async () => {
    const getCrossChainMessenger = await getCrossChain();
    const l2Url = String(process.env.REACT_APP_L2_RPC_URL_ARCHIVAL);
    const l2Provider = new ethers.providers.JsonRpcProvider(l2Url);
    const latestBlock = await l2Provider.getBlockNumber();
    const maxBlocks = 2 * 7 * 24 * 60 * 60; // 2 weeks at 1s blocks
    let offset = 0;
    const blocksPerRound = 45000;
    let data = [];
    while (offset < maxBlocks) {
      const dataPartial = await getCrossChainMessenger.getWithdrawalsByAddress(
        address,
        {
          fromBlock: latestBlock - blocksPerRound - offset,
          toBlock: latestBlock - offset,
        }
      );
      for (let index = 0; index < dataPartial.length; index++) {
        let timestamp = (
          await l2Provider.getBlock(dataPartial[index].blockNumber)
        ).timestamp;
        let getStatus = await getCrossChainMessenger.getMessageStatus(
          dataPartial[index]
        );
        dataPartial[index].messageStatus = getStatus;
        dataPartial[index].timestamp = timestamp;
      }
      data = [...data, ...dataPartial];
      offset += blocksPerRound;
    }
    const getNewWithdrawals = data.map((object) => {
      if (object.messageStatus == 6) {
        return { ...object, message: "Completed" };
      } else if (object.messageStatus == 3) {
        return { ...object, message: "Ready to Prove" };
      } else if (object.messageStatus == 5) {
        return { ...object, message: "Claim Withdrawal" };
      } else if (object.messageStatus == 2) {
        return { ...object, message: "Waiting for Confirmation" };
      } else if (object.messageStatus == 4) {
        return { ...object, message: "In challenge Period" };
      } else {
        return { ...object, message: null };
      }
    });
    setWithdrawDetails(getNewWithdrawals);
    if (getNewWithdrawals) {
      setTransactionLoader(true);
    }
  };
  function timeConverter(timestamp) {
    var a = new Date(timestamp * 1000);
    var months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var hour = a.getHours();
    var min = a.getMinutes();
    var sec = a.getSeconds();
    var time =
      date + " " + month + " " + year + " " + hour + ":" + min + ":" + sec;
    return time;
  }

  const handleProve = async (event, transactionHash) => {
    console.log({ transactionHash });
    try {
      const index = event.target.getAttribute("data-value");
      setLoader(index);
      const getCrossChainMessenger = await getCrossChain();
      const response = await getCrossChainMessenger.proveMessage(
        transactionHash
      );
      console.log({ response });
      const logs = await response.wait();
      console.log({ logs });
      if (logs.status === 1) {
        getWithdraw();
        setLoader(NaN);
      }
    } catch (error) {
      console.log({ error });
      if (error.code === "ACTION_REJECTED") {
      } else {
        alert("error, check console");
      }
      setLoader(NaN);
    }
  };

  const handleClaim = async (event, transactionHash) => {
    try {
      const index = event.target.getAttribute("data-value");
      setLoader(index);
      const getCrossChainMessenger = await getCrossChain();
      const response = await getCrossChainMessenger.finalizeMessage(
        transactionHash
      );
      const logs = await response.wait();
      if (logs.status === 1) {
        getWithdraw();
        setLoader(NaN);
      }
    } catch (error) {
      // if(error.code === -32603){
      //     console.log("Already claim");
      // }
      if (error.code === "ACTION_REJECTED") {
        setLoader(NaN);
      }
    }
  };

  useEffect(() => {
    if (isConnected) {
      if (chain.id != process.env.REACT_APP_L1_CHAIN_ID) {
        switchNetwork(process.env.REACT_APP_L1_CHAIN_ID);
      } else {
        getWithdraw();
      }
    }
  }, [chain, address]);
  // =============all Collections pagination start===============
  const [currentItemsCollections, setCurrentItemsCollections] = useState([]);
  const [pageCountCollections, setPageCountCollections] = useState(0);
  const [itemOffsetCollections, setItemOffsetCollections] = useState(0);
  const itemsPerPageCollections = 10;

  function retrieveEthValue(amount, givenType) {
    const weiValue = parseInt(amount._hex, 16);
    const dynamicDecimal =
      TOKEN_LIST.filter(
        (a) => a.l2Address.toLowerCase() === givenType.toLowerCase()
      )[0]?.decimalValue === undefined
        ? 18
        : TOKEN_LIST.filter(
            (a) => a.l2Address.toLowerCase() === givenType.toLowerCase()
          )[0]?.decimalValue;
    return weiValue / Number("1".padEnd(dynamicDecimal + 1, 0));
  }

  useEffect(() => {
    if (withdrawDetails) {
      const endOffsetCollections =
        itemOffsetCollections + itemsPerPageCollections;
      setCurrentItemsCollections(
        withdrawDetails.slice(itemOffsetCollections, endOffsetCollections)
      );
      setPageCountCollections(
        Math.ceil(withdrawDetails.length / itemsPerPageCollections)
      );
    } else {
    }
  }, [withdrawDetails, itemOffsetCollections, itemsPerPageCollections]);

  const handlePageClickCollections = (event) => {
    const newOffsetCollections =
      (event.selected * itemsPerPageCollections) % withdrawDetails.length;
    setItemOffsetCollections(newOffsetCollections);
  };
  // =============all Collections pagination end===============
  console.log("withdrawDetails", { currentItemsCollections, withdrawDetails });
  return (
    <>
      <div className="account_wrap">
        <Container>
          <div className="account_inner_wrap">
            <Account />
            <section className="account_withdraw_table">
              {!transactionLoader ? (
                <>
                  <p className="white">
                    Scanning up to 2 weeks of blocks.. be patient...
                  </p>
                  <div className="lds-ellipsis">
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                  </div>
                </>
              ) : withdrawDetails?.length <= 0 ? (
                <h4 className="text-center text-white">No Transaction Found</h4>
              ) : (
                <Table responsive bordered hover variant="dark">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Transaction</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItemsCollections.map((element, index) => {
                      const {
                        timestamp,
                        message,
                        transactionHash,
                        amount,
                        messageStatus,
                        l2Token,
                      } = element;
                      console.log("message", messageStatus);
                      return (
                        <tr key={index}>
                          <td>{timeConverter(timestamp)}</td>
                          <td>Withdraw</td>
                          <td>
                            {retrieveEthValue(amount, l2Token)}{" "}
                            {TOKEN_LIST.filter(
                              (a) =>
                                a.l2Address.toLowerCase() ===
                                l2Token.toLowerCase()
                            )[0]?.tokenSymbol === undefined
                              ? "BNB"
                              : TOKEN_LIST.filter(
                                  (a) =>
                                    a.l2Address.toLowerCase() ===
                                    l2Token.toLowerCase()
                                )[0]?.tokenSymbol}
                          </td>
                          <td>
                            {" "}
                            <a
                              href={`https://opbnbscan.com/tx/${transactionHash}`}
                              target="_blank"
                            >
                              {" "}
                              {`${transactionHash.slice(
                                0,
                                8
                              )}...${transactionHash.slice(-8)}`}
                            </a>
                          </td>
                          <td>
                            {message}{" "}
                            {messageStatus === 3 ? (
                              index == loader ? (
                                <button
                                  type="button"
                                  className="btn withdraw_inner_btn"
                                >
                                  <Spinner animation="border" role="status">
                                    <span className="visually-hidden">
                                      Loading...
                                    </span>
                                  </Spinner>{" "}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn withdraw_inner_btn"
                                  data-value={index}
                                  onClick={(event) =>
                                    handleProve(event, transactionHash)
                                  }
                                >
                                  Prove
                                </button>
                              )
                            ) : messageStatus === 5 ? (
                              index == loader ? (
                                <button
                                  type="button"
                                  className="btn withdraw_inner_btn"
                                >
                                  <Spinner animation="border" role="status">
                                    <span className="visually-hidden">
                                      Loading...
                                    </span>
                                  </Spinner>{" "}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn withdraw_inner_btn"
                                  data-value={index}
                                  onClick={(event) =>
                                    handleClaim(event, transactionHash)
                                  }
                                >
                                  Claim
                                </button>
                              )
                            ) : (
                              ""
                            )}{" "}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
              {withdrawDetails?.length > 10 ? (
                <div className="pagination_wrap">
                  <ReactPaginate
                    breakLabel="..."
                    nextLabel=" >>"
                    onPageChange={handlePageClickCollections}
                    pageRangeDisplayed={1}
                    marginPagesDisplayed={1}
                    pageCount={pageCountCollections}
                    previousLabel="<< "
                    containerClassName="pagination justify-content-end"
                    pageClassName="page-item"
                    pageLinkClassName="page-link"
                    previousClassName="page-item"
                    previousLinkClassName="page-link"
                    nextClassName="page-item"
                    nextLinkClassName="page-link"
                    breakClassName="page-item"
                    breakLinkClassName="page-link"
                    activeClassName="active"
                  />
                </div>
              ) : (
                ""
              )}
            </section>
          </div>
        </Container>
      </div>
    </>
  );
};

export default WithdrawAccount;
