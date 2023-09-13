import styles from "./SelectAvatarButton.module.css";
import robot_icon from "../../assets/robot_icon.png";
import cartoon_icon from "../../assets/cartoon_icon.png";
import { useEffect } from "react";

interface Props {
    setSelectedAvatar: (avatar: string) => void;
    selectedAvatar: string;
}

export const SelectAvatarButton = ({ setSelectedAvatar, selectedAvatar }: Props) => {
    const onClick = (avatar: string) => {
        console.log("clicked");
        setSelectedAvatar(avatar);
    };
    return (
        <div className={styles.container}>
            <div className={selectedAvatar === "robot" ? styles.logoSelected : styles.logo}>
                <img
                    src={robot_icon}
                    id="change-to-robot-button"
                    alt="robot icon"
                    aria-label="Change to robot avatar"
                    width="80px"
                    height="auto"
                    onClick={() => onClick("robot")}
                />
            </div>

            <div className={selectedAvatar === "cartoon" ? styles.logoSelected : styles.logo}>
                <img
                    src={cartoon_icon}
                    id="change-to-cartoon-button"
                    alt="cartoon icon"
                    aria-label="Change to cartoon avatar"
                    width="80px"
                    onClick={() => onClick("cartoon")}
                />
            </div>
        </div>
    );
};
