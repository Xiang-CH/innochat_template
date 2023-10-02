export const avatar_const: {
    [key: string]: {
        scale: number;
        x: number;
        y: number;
        z: number;
        r: number;
        filename: string;
        bg: string;
        head: string;
        teeth: string;
        head_dic: string;
        teeth_dic: string;
        voice: string;
    };
} = {
    robot: {
        scale: 0.13,
        x: -0.125,
        y: 1.125,
        z: 0.03,
        r: 0.15,
        filename: "ROBOT_FINAL.glb",
        bg: "robot_bg.png",
        head_dic: "Head",
        head: "Head",
        teeth_dic: "Head",
        teeth: "Head",
        voice: "en-US-GuyNeural"
    },
    cartoon: {
        scale: 0.8,
        x: -0.125,
        y: 0.3,
        z: 0.1,
        r: 0.15,
        filename: "KitFixed_3.glb",
        bg: "innowing.jpeg",
        head_dic: "Head",
        head: "Wolf3D_Head",
        teeth_dic: "Teeth",
        teeth: "Wolf3D_Teeth",
        voice: "en-US-GuyNeural"
    },
    custom: {
        
        scale: 0.7,
        x: -0.12,
        y: 0.55,
        z: 0.1,
        r: 0.15,
        filename: "__FILENAME__.glb",
        bg: "background.jpg",
        voice: "__VOICE__",

        head_dic: "Head",
        head: "Wolf3D_Head",
        teeth_dic: "Teeth",
        teeth: "Wolf3D_Teeth",
    }
};
