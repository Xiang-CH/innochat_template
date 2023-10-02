import { useState, useEffect } from "react";


import innowingLogo from "../../assets/innowing-logo-wide.png";
import styles from "./Layout.module.css";

interface Props {
    setMode: (mode: string) => void;
    mode: string;
}

const Layout = ({ setMode, mode }: Props) => {
    const [activeLink, setActiveLink] = useState<string>(mode);

    const onNavClick = (e: React.MouseEvent<HTMLAnchorElement> | undefined) => {
        if (e) {
            e.preventDefault();
            setActiveLink(e.currentTarget.id);
            setMode(e.currentTarget.id);
        }
    };

    return (
        <header className={styles.header} role={"banner"}>
            <div className={styles.headerContainer}>
                <div className={styles.logo}>
                    <a href="https://innowings.engg.hku.hk/" target={"_blank"} title="Github repository link">
                        <img src={innowingLogo} alt="Innowing logo" aria-label="Link to Innowing website" width="150px" />
                    </a>
                </div>
                {/* <nav>
                    <ul className={styles.headerNavList}>
                        <li>
                            <a
                                href="#"
                                id="chat"
                                className={activeLink == "chat" ? styles.headerNavPageLinkActive : styles.headerNavPageLink}
                                onClick={onNavClick}
                            >
                                InnoChat
                            </a>
                        </li>
                        <li className={styles.headerNavLeftMargin}>
                            <a
                                href="#"
                                id="avatar"
                                className={activeLink == "avatar" ? styles.headerNavPageLinkActive : styles.headerNavPageLink}
                                onClick={onNavClick}
                            >
                                Innova
                            </a>
                        </li>
                    </ul>
                </nav> */}

                <h4 className={styles.headerRightText}>
                    Powered by: <span style={{ fontSize: 12 }}>Azure OpenAI</span>
                </h4>
            </div>
        </header>
    );
};

export default Layout;
