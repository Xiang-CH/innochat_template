import { Text } from "@fluentui/react";
import { Delete24Regular } from "@fluentui/react-icons";

import styles from "./ClearChatButton.module.css";

interface Props {
    className?: string;
    onClick: () => void;
    disabled?: boolean;
    mode?: string;
}

export const ClearChatButton = ({ className, disabled, onClick, mode }: Props) => {
    return (
        <div className={`${styles.container} ${className ?? ""} ${disabled && styles.disabled} ${mode == "avatar" && styles.light}`} onClick={onClick}>
            <Delete24Regular />
            <Text className={`${mode == "avatar" && styles.light} `}>{"Clear chat"}</Text>
        </div>
    );
};
