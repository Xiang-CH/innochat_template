import { Sparkle28Filled, Play28Filled, Replay20Filled, Speaker228Filled, ArrowCounterclockwise28Filled } from "@fluentui/react-icons";
import playingIcon from "../../assets/playing.gif";

interface Props {
    isLast?: boolean;
    playing?: boolean;
    pausePlay?: any;
    resumePlay?: any;
    rePlay?: any;
    paused?: boolean;
    ttsOn?: boolean;
}

export const AnswerIcon = ({ isLast, playing, pausePlay, paused, resumePlay, rePlay, ttsOn }: Props) => {
    if (!isLast) {
        return <Sparkle28Filled primaryFill={"#4f943a"} aria-hidden="true" aria-label="Answer logo" />;
    } else {
        if (!ttsOn) return <Sparkle28Filled primaryFill={"#4f943a"} aria-hidden="true" aria-label="Answer logo" />;

        if (paused) {
            return <Play28Filled primaryFill={"#4f943a"} aria-hidden="true" aria-label="Answer logo" onClick={resumePlay} />;
        } else if (playing) {
            return <Speaker228Filled primaryFill={"#4f943a"} aria-hidden="true" aria-label="Answer logo" onClick={pausePlay} />;
            // return <img src={playingIcon} width="30px" onClick={pausePlay} />;
        } else if (!playing) {
            return <ArrowCounterclockwise28Filled primaryFill={"#4f943a"} aria-hidden="true" aria-label="Answer logo" onClick={rePlay} />;
        } else {
            return <Sparkle28Filled primaryFill={"#4f943a"} aria-hidden="true" aria-label="Answer logo" />;
        }
    }
};
