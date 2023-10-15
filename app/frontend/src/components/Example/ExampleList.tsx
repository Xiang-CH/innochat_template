import { Example } from "./Example";
import Config from "../../Config";

import styles from "./Example.module.css";

export type ExampleModel = {
    text: string;
    value: string;
};

const EXAMPLES: ExampleModel[] = [
    {
        text: Config.example_question_1,
        value: Config.example_question_1
    },
    { 
        text: Config.example_question_2, 
        value: Config.example_question_2
    },
    { 
        text: Config.example_question_3, 
        value: Config.example_question_3 }
];

interface Props {
    onExampleClicked: (value: string) => void;
}

export const ExampleList = ({ onExampleClicked }: Props) => {
    return (
        <ul className={styles.examplesNavList}>
            {EXAMPLES.map((x, i) => (
                <li key={i}>
                    <Example text={x.text} value={x.value} onClick={onExampleClicked} />
                </li>
            ))}
        </ul>
    );
};
