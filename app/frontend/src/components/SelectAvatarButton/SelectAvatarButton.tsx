import styles from "./SelectAvatarButton.module.css";
import robot_icon from "../../assets/robot_icon.png";
import cartoon_icon from "../../assets/cartoon_icon.png";
import custom_icon from "../../assets/icon.png";

interface Props {
    setSelectedAvatar: (avatar: string) => void;
    selectedAvatar: string;
    setSpeakText: (text: string) => void;
}

export const SelectAvatarButton = ({ setSelectedAvatar, selectedAvatar, setSpeakText }: Props) => {
    const onClick = (avatar: string) => {
        console.log("clicked");
        setSelectedAvatar(avatar);
        setSpeakText("");
    };
    return (
        <div className={styles.container}>
            <div className={styles.logo}>
                <img
                    className={selectedAvatar === "robot" ? styles.logoSelected : styles.img}
                    src={robot_icon}
                    id="change-to-robot-button"
                    alt="robot icon"
                    aria-label="Change to robot avatar"
                    width="80px"
                    height="auto"
                    onClick={() => onClick("robot")}
                />
            </div>

            <div className={styles.logo}>
                <img
                    className={selectedAvatar === "cartoon" ? styles.logoSelected : styles.img}
                    src={cartoon_icon}
                    id="change-to-cartoon-button"
                    alt="cartoon icon"
                    aria-label="Change to cartoon avatar"
                    width="80px"
                    onClick={() => onClick("cartoon")}
                />
            </div>

            <div className={styles.logo}>
                <img
                    className={selectedAvatar === "custom" ? styles.logoSelected : styles.img}
                    src={custom_icon}
                    id="change-to-custom-button"
                    alt="custom icon"
                    aria-label="Change to custom avatar"
                    width="80px"
                    onClick={() => onClick("custom")}
                />
            </div>
        </div>
    );
};
