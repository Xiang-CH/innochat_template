import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import { initializeIcons } from "@fluentui/react";

import "./index.css";

import Chat from "./pages/chat/Chat";

initializeIcons();

export default function App() {
    return (
        // <React.StrictMode>
        //     <Layout />
        //     <Chat />
        // </React.StrictMode>
        <HashRouter>
            <Routes>
                <Route path="/" element={<Chat />}/>
            </Routes>
        </HashRouter>
    );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
