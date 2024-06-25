import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./assets/style/main.scss";
import reportWebVitals from "./reportWebVitals";
import "bootstrap/dist/css/bootstrap.min.css";
import { store } from "./store";
import { Provider } from "react-redux";
import { WagmiConfig, createConfig, createStorage } from "wagmi";
import { configureChains } from "@wagmi/core";
import { bsc, opBNB } from "@wagmi/core/chains";
import { jsonRpcProvider } from "wagmi/providers/jsonRpc";
import { MetaMaskConnector } from "wagmi/connectors/metaMask";

const { chains, publicClient } = configureChains(
  [bsc, opBNB],
  [
    jsonRpcProvider({
      rpc: (chain) => ({ http: chain.rpcUrls.default.http[0] }),
    }),
  ]
);

export const connectors = [
  new MetaMaskConnector({
    chains,
    options: {
      shimDisconnect: false,
    },
  }),
];

const config = createConfig({
  autoConnect: true,
  connectors,
  storage: createStorage({ storage: window.localStorage }),
  publicClient,
});
const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <WagmiConfig config={config}>
    <Provider store={store}>
      <App />
    </Provider>
    ,
  </WagmiConfig>
);
reportWebVitals();
