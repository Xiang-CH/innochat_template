import {
	AnimationClip,
	KeyframeTrack,
	NumberKeyframeTrack,
} from 'three';

var fps = 60

function createAnimation (recordedData: any[], morphTargetDictionary:{ [key: string]: number; }, bodyPart: string) {

  // console.log("----morphTargetDictionary", morphTargetDictionary)
  // console.log("recordedData.length")
  if (recordedData.length != 0) {
    let animation: any[][] = []
    for (let i = 0; i < Object.keys(morphTargetDictionary).length; i++) {
      animation.push([])
    }
    let time: number[] = []
    let finishedFrames = 0
    recordedData.forEach((d, i) => {
        Object.entries(d.blendshapes).forEach(([key, value]) => {

          if (! (key in morphTargetDictionary)) {return};
          
          // if (key == 'mouthShrugUpper') {
          //   value += 0.4;
          // }

          animation[morphTargetDictionary[key]].push(value)
        });
        time.push(finishedFrames / fps)
        finishedFrames++
    })
    // console.log("-----animation", animation);
    let tracks: KeyframeTrack[] | undefined = []
    let flag = false;
    //create morph animation
    Object.entries(recordedData[0].blendshapes).forEach(([key, value]) => {
      if (! (key in morphTargetDictionary)) {return};
      let i = morphTargetDictionary[key]

        let track = new NumberKeyframeTrack(`${bodyPart}.morphTargetInfluences[${i}]`, time, animation[i])
        if(tracks){
          tracks.push(track)
        }
        
    });

    const clip = new AnimationClip('animation', -1, tracks);
    return clip
  }
  return null
}

export default createAnimation;

