import { Text } from "@fluentui/react";
import { Settings24Regular } from "@fluentui/react-icons";

import styles from "./SettingsButton.module.css";

interface Props {
    className?: string;
    onClick: () => void;
    mode?: string;
}

export const SettingsButton = ({ className, onClick, mode}: Props) => {
    return (
        <div 
            className={`${styles.container} ${className ?? ""} ${mode == "avatar" && styles.light}`} 
            onClick={onClick}>
            <Settings24Regular />
            <Text 
                className={`${mode == "avatar" && styles.light}`}>{"Settings"}
            </Text>
        </div>
    );
};
