import blake2b from 'blake2b';
import CryptoJS from 'crypto-js'


export function xmur3(str) {
    for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = h << 13 | h >>> 19;
    } return () => {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return (h ^= h >>> 16) >>> 0;
    }
}

export function sfc32(a, b, c, d) {
    return function () {

        a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
        var t = (a + b) | 0;
        a = b ^ b >>> 9;
        b = c + (c << 3) | 0;
        c = (c << 21 | c >>> 11);
        d = d + 1 | 0;
        t = t + d | 0;
        c = c + t | 0;
        return (t >>> 0) / 4294967296;
    }
}

export function getRandomIntSync(min, max, seedStr) {
    var seed = xmur3(seedStr + CryptoJS.lib.WordArray.random(16).toString())
    min = Math.ceil(min);
    max = Math.floor(max);
    const rand = sfc32(seed(), seed(), seed(), seed())();

    return Math.floor(rand * (max - min + 1)) + min;
}

export function getRandomIntSFC(min, max, sfc) {

    min = Math.ceil(min);
    max = Math.floor(max);

    const randResult = sfc()

    //mix up the results a lot


    return Math.floor(randResult * (max - min + 1)) + min;
}

export function generateCode(word = "", length = 45) {
    return new Promise(resolve => {
       
        var seed = xmur3(word + CryptoJS.lib.WordArray.random(16).toString())

        const SFC = sfc32(seed(), seed(), seed(), seed());



        for (let i = 0; i < 50; i++) {
            SFC()
        }
        let code = ""

        for (let i = 0; i < length; i++) {
            const char = String.fromCharCode(getRandomIntSFC(0, 126, SFC))
            code = code.concat(char)
        }

        //0


        resolve(code)
    })
}



export const getUintHash = (input, size = 64) => {
    return new Promise(resolve => {
        const hash = new Uint8Array(size)
        const hashLength = hash.length

        blake2b(hashLength).update(input).digest(hash)

        resolve(hash)
    })
}
export const getStringHash = (string, size = 64) => {
    return new Promise(resolve => {
        const hashLength = new Uint8Array(size).length

        const input = Uint8Array.from(Array.from(string).map(letter => letter.charCodeAt(0)));

        const hex = blake2b(hashLength).update(input).digest('hex')

        resolve(hex)
    })
}

export function generateCodeBytes(word = "", length = 512) {
    return new Promise(resolve => {
      
        
        const wordArrString = CryptoJS.lib.WordArray.random(16).toString()
        word = word.concat(wordArrString)

        var seed = xmur3(word + '')

        const SFC = sfc32(seed(), seed(), seed(), seed());



        for (let i = 0; i < 50; i++) {
            SFC()
        }
        let code = []

        for (let i = 0; i < length; i++) {
            code.push(getRandomIntSFC(0, 127, SFC))
        }

        const uintCode = Int8Array.from(code)
        

        resolve(uintCode)
    })
}
