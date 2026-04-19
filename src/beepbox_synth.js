/*
Copyright (C) 2012 John Nesky

Permission is hereby granted, free of charge, to any person obtaining a copy of 
this software and associated documentation files (the "Software"), to deal in 
the Software without restriction, including without limitation the rights to 
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies 
of the Software, and to permit persons to whom the Software is furnished to do 
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all 
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE 
SOFTWARE.
*/

var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var beepbox;
(function (beepbox) {
    function scaleElementsByFactor(array, factor) {
        for (var i = 0; i < array.length; i++) {
            array[i] *= factor;
        }
    }
    beepbox.scaleElementsByFactor = scaleElementsByFactor;
    function isPowerOf2(n) {
        return !!n && !(n & (n - 1));
    }
    function countBits(n) {
        if (!isPowerOf2(n))
            throw new Error("FFT array length must be a power of 2.");
        return Math.round(Math.log(n) / Math.log(2));
    }
    function reverseIndexBits(array) {
        var fullArrayLength = array.length;
        var bitCount = countBits(fullArrayLength);
        if (bitCount > 16)
            throw new Error("FFT array length must not be greater than 2^16.");
        var finalShift = 16 - bitCount;
        for (var i = 0; i < fullArrayLength; i++) {
            var j = void 0;
            j = ((i & 0xaaaa) >> 1) | ((i & 0x5555) << 1);
            j = ((j & 0xcccc) >> 2) | ((j & 0x3333) << 2);
            j = ((j & 0xf0f0) >> 4) | ((j & 0x0f0f) << 4);
            j = ((j >> 8) | ((j & 0xff) << 8)) >> finalShift;
            if (j > i) {
                var temp = array[i];
                array[i] = array[j];
                array[j] = temp;
            }
        }
    }
    function inverseRealFourierTransform(array) {
        var fullArrayLength = array.length;
        var totalPasses = countBits(fullArrayLength);
        if (fullArrayLength < 4)
            throw new Error("FFT array length must be at least 4.");
        for (var pass = totalPasses - 1; pass >= 2; pass--) {
            var subStride = 1 << pass;
            var midSubStride = subStride >> 1;
            var stride = subStride << 1;
            var radiansIncrement = Math.PI * 2.0 / stride;
            var cosIncrement = Math.cos(radiansIncrement);
            var sinIncrement = Math.sin(radiansIncrement);
            var oscillatorMultiplier = 2.0 * cosIncrement;
            for (var startIndex = 0; startIndex < fullArrayLength; startIndex += stride) {
                var startIndexA = startIndex;
                var midIndexA = startIndexA + midSubStride;
                var startIndexB = startIndexA + subStride;
                var midIndexB = startIndexB + midSubStride;
                var stopIndex = startIndexB + subStride;
                var realStartA = array[startIndexA];
                var imagStartB = array[startIndexB];
                array[startIndexA] = realStartA + imagStartB;
                array[midIndexA] *= 2;
                array[startIndexB] = realStartA - imagStartB;
                array[midIndexB] *= 2;
                var c = cosIncrement;
                var s = -sinIncrement;
                var cPrev = 1.0;
                var sPrev = 0.0;
                for (var index = 1; index < midSubStride; index++) {
                    var indexA0 = startIndexA + index;
                    var indexA1 = startIndexB - index;
                    var indexB0 = startIndexB + index;
                    var indexB1 = stopIndex - index;
                    var real0 = array[indexA0];
                    var real1 = array[indexA1];
                    var imag0 = array[indexB0];
                    var imag1 = array[indexB1];
                    var tempA = real0 - real1;
                    var tempB = imag0 + imag1;
                    array[indexA0] = real0 + real1;
                    array[indexA1] = imag1 - imag0;
                    array[indexB0] = tempA * c - tempB * s;
                    array[indexB1] = tempB * c + tempA * s;
                    var cTemp = oscillatorMultiplier * c - cPrev;
                    var sTemp = oscillatorMultiplier * s - sPrev;
                    cPrev = c;
                    sPrev = s;
                    c = cTemp;
                    s = sTemp;
                }
            }
        }
        for (var index = 0; index < fullArrayLength; index += 4) {
            var index1 = index + 1;
            var index2 = index + 2;
            var index3 = index + 3;
            var real0 = array[index];
            var real1 = array[index1] * 2;
            var imag2 = array[index2];
            var imag3 = array[index3] * 2;
            var tempA = real0 + imag2;
            var tempB = real0 - imag2;
            array[index] = tempA + real1;
            array[index1] = tempA - real1;
            array[index2] = tempB + imag3;
            array[index3] = tempB - imag3;
        }
        reverseIndexBits(array);
    }
    beepbox.inverseRealFourierTransform = inverseRealFourierTransform;
})(beepbox || (beepbox = {}));
var beepbox;
(function (beepbox) {
    var Config = (function () {
        function Config() {
        }
        Config._centerWave = function (wave) {
            var sum = 0.0;
            for (var i = 0; i < wave.length; i++)
                sum += wave[i];
            var average = sum / wave.length;
            for (var i = 0; i < wave.length; i++)
                wave[i] -= average;
            return new Float64Array(wave);
        };
        Config.getDrumWave = function (index) {
            var wave = Config._drumWaves[index];
            if (wave == null) {
                wave = new Float32Array(32768);
                Config._drumWaves[index] = wave;
                if (index == 0) {
                    var drumBuffer = 1;
                    for (var i = 0; i < 32768; i++) {
                        wave[i] = (drumBuffer & 1) * 2.0 - 1.0;
                        var newBuffer = drumBuffer >> 1;
                        if (((drumBuffer + newBuffer) & 1) == 1) {
                            newBuffer += 1 << 14;
                        }
                        drumBuffer = newBuffer;
                    }
                }
                else if (index == 1) {
                    for (var i = 0; i < 32768; i++) {
                        wave[i] = Math.random() * 2.0 - 1.0;
                    }
                }
                else if (index == 2) {
                    var drumBuffer = 1;
                    for (var i = 0; i < 32768; i++) {
                        wave[i] = (drumBuffer & 1) * 2.0 - 1.0;
                        var newBuffer = drumBuffer >> 1;
                        if (((drumBuffer + newBuffer) & 1) == 1) {
                            newBuffer += 2 << 14;
                        }
                        drumBuffer = newBuffer;
                    }
                }
				else if (index == 3) {
                    var drumBuffer = 1;
                    for (var i = 0; i < 32767; i++) {
                        wave[i] = (drumBuffer & 1) * 2.0 - 1.0;
                        var newBuffer = drumBuffer >> 2;
                        if (((drumBuffer + newBuffer) & 1) == 1) {
                            newBuffer += 4 << 14;
                        }
                        drumBuffer = newBuffer;
                    }
                }
                else if (index == 4) {
                    var drumBuffer = 1;
                    for (var i = 0; i < 32768; i++) {
                        wave[i] = (drumBuffer & 1) * 2.0 - 1.0;
                        var newBuffer = drumBuffer >> 1;
                        if (((drumBuffer + newBuffer) & 1) == 1) {
                            newBuffer += 10 << 2;
                        }
                        drumBuffer = newBuffer;
                    }
                }
                else if (index == 5) {
                    Config.drawNoiseSpectrum(wave, 10, 11, 1, 1, 0);
                    Config.drawNoiseSpectrum(wave, 11, 14, -2, -2, 0);
                    beepbox.inverseRealFourierTransform(wave);
                    beepbox.scaleElementsByFactor(wave, 1.0 / Math.sqrt(wave.length));
                }
                else if (index == 6) {
                    Config.drawNoiseSpectrum(wave, 1, 10, 1, 1, 0);
                    Config.drawNoiseSpectrum(wave, 20, 14, -2, -2, 0);
                    beepbox.inverseRealFourierTransform(wave);
                    beepbox.scaleElementsByFactor(wave, 1.0 / Math.sqrt(wave.length));
                }
                else if (index == 7) {
                    var drumBuffer = 1;
                    for (var i = 0; i < 32768; i++) {
                        wave[i] = (drumBuffer & 1) * 4.0 * Math.random(1, 15);
                        var newBuffer = drumBuffer >> 1;
                        if (((drumBuffer + newBuffer) & 1) == 1) {
                            newBuffer += 15 << 2;
                        }
                        drumBuffer = newBuffer;
                    }
				}
                else if (index == 8) {
                    var drumBuffer = 1;
                    for (var i = 0; i < 32768; i++) {
                        wave[i] = (drumBuffer & 1) / 2.0 + 0.5;
                        var newBuffer = drumBuffer >> 1;
                        if (((drumBuffer + newBuffer) & 1) == 1) {
                            newBuffer -= 10 << 2;
                        }
                        drumBuffer = newBuffer;
                    }
                }
                else if (index == 9) {
                    for (var i = 0; i < 32768; i++) {
                        wave[i] = Math.random() * 2.0 - 1.0;
                    }
                }
                else {
                    throw new Error("Unrecognized drum index: " + index);
                }
            }
            return wave;
        };
        Config.drawNoiseSpectrum = function (wave, lowOctave, highOctave, lowPower, highPower, overalSlope) {
            var referenceOctave = 11;
            var referenceIndex = 1 << referenceOctave;
            var lowIndex = Math.pow(2, lowOctave) | 0;
            var highIndex = Math.pow(2, highOctave) | 0;
            var log2 = Math.log(2);
            for (var i = lowIndex; i < highIndex; i++) {
                var amplitude = Math.pow(2, lowPower + (highPower - lowPower) * (Math.log(i) / log2 - lowOctave) / (highOctave - lowOctave));
                amplitude *= Math.pow(i / referenceIndex, overalSlope);
                var radians = Math.random() * Math.PI * 2.0;
                wave[i] = Math.cos(radians) * amplitude;
                wave[32768 - i] = Math.sin(radians) * amplitude;
            }
        };
        Config.generateSineWave = function () {
            var wave = new Float64Array(Config.sineWaveLength + 1);
            for (var i = 0; i < Config.sineWaveLength + 1; i++) {
                wave[i] = Math.sin(i * Math.PI * 2.0 / Config.sineWaveLength);
            }
            return wave;
        };
        return Config;
    }());
    Config.scaleNames = ["easy :)", "easy :(", "island :)", "island :(", "blues :)", "blues :(", "normal :)", "normal :(", "dbl harmonic :)", "dbl harmonic :(", "enigma", "expert", "monotonic", "no dabbing"];
    Config.scaleFlags = [
        [true, false, true,  false, true,  false, false, true,  false, true,  false, false],
        [true, false, false, true,  false, true,  false, true,  false, false, true,  false],
        [true, false, false, false, true,  true,  false, true,  false, false, false, true ],
        [true, true,  false, true,  false, false, false, true,  true,  false, false, false],
        [true, false, true,  true,  true,  false, false, true,  false, true,  false, false],
        [true, false, false, true,  false, true,  true,  true,  false, false, true,  false],
        [true, false, true,  false, true,  true,  false, true,  false, true,  false, true ],
        [true, false, true,  true,  false, true,  false, true,  true,  false, true,  false],
        [true, true,  false, false, true,  true,  false, true,  true,  false, false, true ],
        [true, false, true,  true,  false, false, true,  true,  true,  false, false, true ],
        [true, false, true,  false, true,  false, true,  false, true,  false, true,  false],
        [true, true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  true ],
		[true, false, false, false, false, false, false, false, false, false, false, false],
		[true, true,  false, true,  true,  true,  true,  true,  true,  false, true,  false],
    ];
    Config.pianoScaleFlags =     [ true, false, true, false, true, true, false, true, false, true, false, true];
    Config.blackKeyNameParents = [-1,   1,     -1,    1,    -1,    1,   -1,    -1,    1,    -1,    1,   -1    ];
    Config.pitchNames =          ["C", null, "D", null, "E", "F", null, "G", null, "A", null, "B"];
	
	Config.themeNames = ["Default", "ModBox 2.0", "Artic", "Cinnamon Roll [!]", "Ocean", "Rainbow [!]", "Float [!]", "Windows", "Grassland", "Dessert", "Kahootiest", "Beam to the Bit [!]", "Pretty Egg", "Poniryoshka", "Gameboy [!]", "Woodkid", "Midnight", "Snedbox", "unnamed", "Piano [!] [↻]", "Halloween", "FrozenOver❄️"];
	
	volumeColorPallet =            ["#777777", "#c4ffa3", "#42dcff", "#ba8418", "#090b3a", "#ff00cb", "#878787", "#15a0db", "#74bc21", "#ff0000", "#66bf39", "#fefe00", "#f01d7a", "#ffc100", "#8bac0f", "#ef3027", "#aa5599", "#a53a3d", "#ffffff", "#ff0000", "#9e2200", "#ed2d2d"]
	sliderOneColorPallet =         ["#9900cc", "#00ff00", "#ffffff", "#ba8418", "#5982ff", "#ff0000", "#ffffff", "#2779c2", "#a0d168", "#ff6254", "#ff3355", "#fefe00", "#6b003a", "#4b4b4b", "#9bbc0f", "#e83c4e", "#445566", "#a53a3d", "#ffffff", "#ffffff", "#9e2200", "#38ef17"]
	sliderOctaveColorPallet =      ["#444444", "#00ff00", "#a5eeff", "#e59900", "#4449a3", "#43ff00", "#ffffff", "#295294", "#74bc21", "#ff5e3a", "#eb670f", "#0001fc", "#ffb1f4", "#5f4c99", "#9bbc0f", "#ef3027", "#444444", "#444444", "#ffffff", "#211616", "#9e2200", "#ffffff"]
	sliderOctaveNotchColorPallet = ["#886644", "#ffffff", "#cefffd", "#ffff25", "#3dffdb", "#0400ff", "#c9c9c9", "#fdd01d", "#20330a", "#fff570", "#ff3355", "#fa0103", "#b4001b", "#ff8291", "#8bac0f", "#ffedca", "#aa5599", "#a53a3d", "#ffffff", "#ff4c4c", "#701800", "#ed2d2d"]
	buttonColorPallet =            ["#ffffff", "#00ff00", "#42dcff", "#ffff25", "#4449a3", "#f6ff00", "#000000", "#fdd01d", "#69c400", "#fffc5b", "#66bf39", "#fefe00", "#75093e", "#818383", "#8bac0f", "#ffedca", "#000000", "#ffffff", "#ffffff", "#ffffff", "#9e2200", "#38ef17"]
	
	// For Piano Theme
	noteOne =            ["#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#9e2200"]
	noteTwo =            ["#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#9e2200"]
	noteThree =          ["#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#9e2200"]
	noteFour =           ["#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#9e2200"]
	noteSix =            ["#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#9e2200"]
	noteSeven =          ["#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#9e2200"]
	noteEight =          ["#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#9e2200"]
	noteFive =           ["#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#9e2200"]
	noteNine =           ["#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#9e2200"]
	noteTen =            ["#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#9e2200"]
	noteEleven =         ["#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#9e2200"]
	noteTwelve =         ["#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#7a7a7a", "#bfbfbf", "#bfbfbf", "#9e2200"]
	
	// Gives Color of the Sheet
	baseNoteColorPallet =           ["#886644", "#c4ffa3", "#eafffe", "#f5bb00", "#090b3a", "#ffaaaa", "#ffffff", "#da4e2a", "#20330a", "#fffc5b", "#45a3e5", "#fefe00", "#fffafa", "#1a2844", "#9bbc0f", "#fff6fe", "#222222", "#886644", "#ffffa0", "#ffffff", "#681701", "#88bce8"]
	secondNoteColorPallet =         ["#444444", "#444444", "#444444", "#f5bb00", "#444444", "#ffceaa", "#ededed", "#444444", "#444444", "#444444", "#444444", "#111111", "#444444", "#444444", "#9bbc0f", "#41323b", "#222222", "#444444", "#ffffa0", "#ffffff", "#754a3f", "#99c8ef"]
	thirdNoteColorPallet =          ["#444444", "#444444", "#444444", "#f5bb00", "#444444", "#ffdfaa", "#cecece", "#444444", "#444444", "#444444", "#444444", "#111111", "#444444", "#444444", "#9bbc0f", "#41323b", "#222222", "#444444", "#ffffa0", "#ffffff", "#754a3f", "#abd3f4"]
	fourthNoteColorPallet =         ["#444444", "#444444", "#444444", "#f5bb00", "#444444", "#fff5aa", "#bababa", "#444444", "#444444", "#444444", "#444444", "#111111", "#444444", "#444444", "#8bac0f", "#41323b", "#222222", "#444444", "#ffffa0", "#ffffff", "#754a3f", "#b8d7f2"]
	sixthNoteColorPallet =          ["#444444", "#444444", "#444444", "#f5bb00", "#444444", "#e8ffaa", "#afafaf", "#444444", "#444444", "#444444", "#444444", "#fa0103", "#444444", "#faf4c3", "#8bac0f", "#41323b", "#222222", "#10997e", "#ffffa0", "#ffffff", "#754a3f", "#cbe0f2"]
	seventhNoteColorPallet =        ["#444444", "#444444", "#444444", "#f5bb00", "#444444", "#bfffb2", "#a5a5a5", "#444444", "#444444", "#444444", "#444444", "#111111", "#444444", "#444444", "#8bac0f", "#41323b", "#222222", "#444444", "#ffffa0", "#ffffff", "#754a3f", "#e5f0f9"]
	eigthNoteColorPallet =          ["#444444", "#444444", "#444444", "#f5bb00", "#444444", "#b2ffc8", "#999999", "#444444", "#444444", "#444444", "#444444", "#111111", "#444444", "#444444", "#306230", "#41323b", "#222222", "#444444", "#ffffa0", "#ffffff", "#754a3f", "#ffffff"]
	fifthNoteColorPallet =          ["#446688", "#96fffb", "#b7f1ff", "#f5bb00", "#3f669b", "#b2ffe4", "#8e8e8e", "#5d9511", "#74bc21", "#ff5e3a", "#864cbf", "#111111", "#ff91ce", "#dabbe6", "#306230", "#fff6fe", "#444444", "#60389b", "#ffffa0", "#ffffff", "#914300", "#e5f0f9"]
	ninthNoteColorPallet =          ["#444444", "#444444", "#444444", "#f5bb00", "#444444", "#b2f3ff", "#828282", "#444444", "#444444", "#444444", "#444444", "#0001fc", "#444444", "#444444", "#306230", "#41323b", "#222222", "#444444", "#ffffa0", "#ffffff", "#754a3f", "#cbe0f2"]
	tenNoteColorPallet =            ["#444444", "#444444", "#444444", "#f5bb00", "#444444", "#b2b3ff", "#777777", "#444444", "#444444", "#444444", "#444444", "#111111", "#444444", "#444444", "#0f380f", "#41323b", "#222222", "#444444", "#ffffa0", "#ffffff", "#754a3f", "#b8d7f2"]
	elevenNoteColorPallet =         ["#444444", "#444444", "#444444", "#f5bb00", "#444444", "#e0b2ff", "#565656", "#444444", "#444444", "#444444", "#444444", "#111111", "#444444", "#444444", "#0f380f", "#41323b", "#222222", "#444444", "#ffffa0", "#ffffff", "#754a3f", "#abd3f4"]
	twelveNoteColorPallet =         ["#444444", "#444444", "#444444", "#f5bb00", "#444444", "#ffafe9", "#282828", "#444444", "#444444", "#444444", "#444444", "#111111", "#444444", "#444444", "#0f380f", "#41323b", "#222222", "#444444", "#ffffa0", "#ffffff", "#754a3f", "#99c8ef"]	
	
	channelOneBrightColorPallet =         ["#25f3ff"]
	channelTwoBrightColorPallet =         ["#44ff44"]
	channelThreeBrightColorPallet =       ["#ffff25"]
	channelFourBrightColorPallet =        ["#ff9752"]
	channelFiveBrightColorPallet =        ["#ff90ff"]
	channelSixBrightColorPallet =         ["#9f31ea"]
	channelSevenBrightColorPallet =       ["#2b6aff"]
	channelEightBrightColorPallet =       ["#00ff9f"]
	channelNineBrightColorPallet =        ["#ffbf00"]
	channelTenBrightColorPallet =         ["#d85d00"]
	channelElevenBrightColorPallet =      ["#ff00a1"]
	channelTwelveBrightColorPallet =      ["#c26afc"]
	channelThirteenBrightColorPallet =    ["#ff1616"]
	channelFourteenBrightColorPallet =    ["#ffffff"]
	channelFifteenBrightColorPallet =     ["#768dfc"]
	channelSixteenBrightColorPallet =     ["#a5ff00"]

	channelOneDimColorPallet =         ["#0099a1"]
	channelTwoDimColorPallet =         ["#439143"]
	channelThreeDimColorPallet =       ["#a1a100"]
	channelFourDimColorPallet =        ["#c75000"]
	channelFiveDimColorPallet =        ["#d020d0"]
	channelSixDimColorPallet =         ["#552377"]
	channelSevenDimColorPallet =       ["#221b89"]
	channelEightDimColorPallet =       ["#00995f"]
	channelNineDimColorPallet =        ["#d6b03e"]
	channelTenDimColorPallet =         ["#b25915"]
	channelElevenDimColorPallet =      ["#891a60"]
	channelTwelveDimColorPallet =      ["#965cbc"]
	channelThirteenDimColorPallet =    ["#991010"]
	channelFourteenDimColorPallet =    ["#aaaaaa"]
	channelFifteenDimColorPallet =     ["#5869BD"]
	channelSixteenDimColorPallet =     ["#7c9b42"]
	
    Config.keyNames =      ["B", "A♯", "A", "G♯", "G", "F♯", "F", "E", "D♯", "D", "C♯", "C"];
    Config.keyTransposes = [23,  22,   21,  20,   19,  18,   17,  16,  15,   14,  13,   12 ];
    Config.mixNames =      ["Type A (B & S)", "Type B (M)", "Type C"];
    Config.sampleRateNames =     ["44100kHz", "48000kHz", "default", "×4", "×2", "÷2", "÷4", "÷8", "÷16"];
    Config.tempoSteps = 24;
    Config.reverbRange = 5;
    Config.blendRange = 4;
    Config.riffRange = 11;
	Config.detuneRange = 24;
	Config.muffRange = 24;
    Config.beatsPerBarMin = 1;
    Config.beatsPerBarMax = 24;
    Config.barCountMin = 1;
    Config.barCountMax = 256;
    Config.patternsPerChannelMin = 1;
    Config.patternsPerChannelMax = 99;
    Config.instrumentsPerChannelMin = 1;
    Config.instrumentsPerChannelMax = 99;
    Config.partNames =  ["÷3 (triplets)", "÷4 (standard)", "÷6", "÷8", "÷16 (arpfest)", "÷12", "÷9", "÷5", "÷50", "÷24"];
    Config.partCounts = [3,               4,               6,    8,    16,              12,    9,    5,    50,    24   ];
    Config.waveNames =   ["triangle", "square", "pulse wide", "pulse narrow", "sawtooth", "double saw", "double pulse", "spiky", "plateau", "glitch", "10% pulse", "sunsoft bass", "loud pulse", "sax", "guitar", "sine", "atari bass", "atari pulse", "1% pulse", "curved sawtooth", "viola", "brass", "acoustic bass", "lyre", "ramp pulse", "piccolo", "squaretooth", "flatline", "pnryshk a (u5)", "pnryshk b (riff)"];
    Config.waveVolumes = [1.0,        0.5,      0.5,          0.5,            0.65,       0.5,          0.4,            0.4,     0.94,      0.5,      0.5,         1.0,            0.6,          0.1,   0.25,     1.0,    1.0,          1.0,           1.0,        1.0,               1.0,     1.0,     1.0,             0.2,    0.2,          0.9,       0.9,           1.0,        0.4,                 0.5];
    Config.drumNames =           ["retro", "white", "periodic", "detuned periodic", "shine", "hollow", "deep", "cutter", "metallic", "snare"];
    Config.drumVolumes =         [0.25,    1.0,     0.4,        0.3,                0.3,     1.5,      1.5,    0.25,     1.0,       1.0];
    Config.drumBasePitches =     [69,      69,      69,         69,                 69,      96,       120,    96,       96,        69];
    Config.drumPitchFilterMult = [100.0,   8.0,     100.0,      100.0,              100.0,   1.0,      100.0,  100.0,    100.0,     100.0];
    Config.drumWaveIsSoft =      [false,   true,    false,      false,              false,   true,     true,   false,    false,     false];
    Config._drumWaves =          [null, null, null, null, null, null, null, null, null, null];
	Config.pwmwaveNames = ["5%", "10%", "15%", "20%", "25%", "30%", "35%", "40%", "45%", "50%"];
    Config.pwmwaveVolumes = [1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0,1.0];
    Config.filterNames = ["none", "sustain sharp", "sustain medium", "sustain soft", "decay sharp", "decay medium", "decay soft", "decay drawn", "fade sharp", "fade medium", "fade soft", "ring", "muffled", "submerged", "shift", "overtone", "woosh", "undertone"];
    Config.filterBases = [0.0, 2.0, 3.5, 5.0, 1.0, 2.5, 4.0, 1.0, 5.0, 7.5, 10.0, -1.0, 4.0, 6.0, 0.0, 1.0, 2.0, 5.0];
    Config.filterDecays = [0.0, 0.0, 0.0, 0.0, 10.0, 7.0, 4.0, 0.5, -10.0, -7.0, -4.0, 0.2, 0.2, 0.3, 0.0, 0.0, -6.0, 0.0];
    Config.filterVolumes = [0.2, 0.4, 0.7, 1.0, 0.5, 0.75, 1.0, 0.5, 0.4, 0.7, 1.0, 0.5, 0.75, 0.4, 0.4, 1.0, 0.5, 1.75];
    Config.transitionNames = ["seamless", "sudden", "smooth", "slide", "trill", "click", "bow", "blip"];
    Config.effectNames = ["none", "vibrato light", "vibrato delayed", "vibrato heavy", "tremolo light", "tremolo heavy", "alien", "stutter", "strum"];
    Config.effectVibratos = [0.0, 0.15, 0.3, 0.45, 0.0, 0.0, 1.0, 0.0, 0.05];
    Config.effectTremolos = [0.0, 0.0, 0.0, 0.0, 0.25, 0.5, 0.0, 1.0, 0.025];
    Config.effectVibratoDelays = [0, 0, 3, 0, 0, 0, 0, 0];
    Config.chorusNames = ["union", "shimmer", "hum", "honky tonk", "dissonant", "fifths", "octaves", "spinner", "detune", "bowed", "rising", "vibrate", "fourths", "bass", "dirty", "stationary", "harmonic (legacy)", "recurve", "voiced", "fluctuate"];
    Config.chorusIntervals = [0.0, 0.02, 0.05, 0.1, 0.25, 3.5, 6, 0.02, 0.0, 0.02, 1.0, 3.5, 4, 0, 0.0, 3.5, 0.0, 0.005, 0.25, 12];
    Config.chorusOffsets = [0.0, 0.0, 0.0, 0.0, 0.0, 3.5, 6, 0.0, 0.25, 0.0, 0.7, 7, 4, -7, 0.1, 0.0, 0.0, 0.0, 3.0, 0.0];
    Config.chorusVolumes = [0.9, 0.9, 1.0, 1.0, 0.95, 0.95, 0.9, 1.0, 1.0, 1.0, 0.95, 0.975, 0.95, 1.0, 0.975, 0.9, 1.0, 1.0, 0.9, 1.0];
    Config.chorusSigns = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, -1.0, 1.0, 1.0];
    Config.chorusRiffApp = [0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
    Config.chorusHarmonizes = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];
	Config.harmDisplay = ["arpeggio", "duet", "chord", "seventh", "half arpeggio", "arp-chord"];
    Config.harmNames = [0, 1, 2, 3, 4, 5];
	Config.fmChorusDisplay = ["none", "default", "detune", "honky tonk", "consecutive", "alt. major thirds", "alt. minor thirds", "fifths", "octaves"];
	Config.fmChorusNames = [0, 1, 2, 3, 4, 5, 6, 7, 8];
	Config.imuteNames = ["◉", "◎"];
	Config.imuteValues = [1, 0];
    Config.harmonyNames = Config.harmNames;
    Config.harmonyDisplayNames = Config.harmDisplay;
    Config.fmChorusDisplayNames = Config.fmChorusDisplay;
    Config.muteNames = Config.imuteNames;
    Config.muteValues = Config.imuteValues;
	Config.octoffNames = ["none", "+2 (2 octaves)",  "+1 1/2 (octave and fifth)",  "+1 (octave)",  "+1/2 (fifth)", "-1/2 (fifth)", "-1 (octave)", "-1 1/2 (octave and fifth)", "-2 (2 octaves"];
	Config.octoffValues = [0.0, 24.0, 19.0, 12.0, 7.0, -7.0, -12.0, -19.0, -24.0];
    Config.octaveOffsetNames = Config.octoffNames;
    Config.octaveOffsetValues = Config.octoffValues;
	Config.volumeNames = ["loudest", "loud", "medium", "quiet", "quietest", "mute", "i", "couldnt", "be", "bothered"];
    Config.volumeValues = [0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, -1.0];
    Config.volumeMValues = [0.0, 0.5, 1.0, 1.5, 2.0, -1.0];
    Config.ipanValues = [-1.0, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 1.0];
    Config.panValues = Config.ipanValues;
    Config.mixDisplayNames = Config.mixNames;
    Config.sampleRateDisplayNames = Config.sampleRateNames;
    Config.rhythmNames = Config.partNames;
    Config.pwmWaveNames = Config.pwmwaveNames;
    Config.operatorCount = 4;
	
    Config.operatorAlgorithmNames = [
        "1←(2 3 4)",
        "1←(2 3←4)",
        "1←2←(3 4)",
        "1←(2 3)←4",
        "1←2←3←4",
        "1←3 2←4",
        "1 2←(3 4)",
        "1 2←3←4",
        "(1 2)←3←4",
        "(1 2)←(3 4)",
        "1 2 3←4",
        "(1 2 3)←4",
        "1 2 3 4",
    ];
    Config.midiAlgorithmNames = ["1<(2 3 4)", "1<(2 3<4)", "1<2<(3 4)", "1<(2 3)<4", "1<2<3<4", "1<3 2<4", "1 2<(3 4)", "1 2<3<4", "(1 2)<3<4", "(1 2)<(3 4)", "1 2 3<4", "(1 2 3)<4", "1 2 3 4"];
    Config.operatorModulatedBy = [
        [[2, 3, 4], [], [], []],
        [[2, 3], [], [4], []],
        [[2], [3, 4], [], []],
        [[2, 3], [4], [4], []],
        [[2], [3], [4], []],
        [[3], [4], [], []],
        [[], [3, 4], [], []],
        [[], [3], [4], []],
        [[3], [3], [4], []],
        [[3, 4], [3, 4], [], []],
        [[], [], [4], []],
        [[4], [4], [4], []],
        [[], [], [], []],
    ];
    Config.operatorAssociatedCarrier = [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 2, 1, 2],
        [1, 2, 2, 2],
        [1, 2, 2, 2],
        [1, 2, 2, 2],
        [1, 2, 2, 2],
        [1, 2, 3, 3],
        [1, 2, 3, 3],
        [1, 2, 3, 4],
    ];
    Config.operatorCarrierCounts = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 4];
Config.operatorCarrierChorus = [
	[0.0, 0.0, 0.0, 0.0],
	[0.0, 0.04, -0.073, 0.091],
	[0.5, 0.54, 0.427, 0.591],
	[0.0, 0.26, -0.45, 0.67],
	[0.0, 1.0, 2.0, 3.0],
	[0.0, 4.0, 7.0, 11.0],
	[0.0, 3.0, 7.0, 10.0],
	[0.0, 7.0, 14.0, 21.0],
	[0.0, 12.0, 24.0, 36.0],
	];
    Config.operatorAmplitudeMax = 15;
    Config.operatorFrequencyNames = ["1×", "~1×", "2×", "~2×", "3×", "4×", "5×", "6×", "7×", "8×", "9×", "10×", "11×", "13×", "16×", "20×"];
    Config.midiFrequencyNames = ["1x", "~1x", "2x", "~2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x", "11x", "13x", "16x", "20x"];
    Config.operatorFrequencies = [1.0, 1.0, 2.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 13.0, 16.0, 20.0];
    Config.operatorHzOffsets = [0.0, 1.5, 0.0, -1.3, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
    Config.operatorAmplitudeSigns = [1.0, -1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
    Config.operatorEnvelopeNames = ["custom", "steady", "punch", "flare 1", "flare 2", "flare 3", "pluck 1", "pluck 2", "pluck 3", "swell 1", "swell 2", "swell 3", "tremolo1", "tremolo2", "tremolo3", "custom flare", "custom tremolo", "flute 1", "flute 2", "flute 3"];
    Config.operatorEnvelopeType = [0, 1, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 3, 5, 6, 6, 6];
	Config.operatorSpecialCustomVolume = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true, true, false, false, false];
    Config.operatorEnvelopeSpeed = [0.0, 0.0, 0.0, 32.0, 8.0, 2.0, 32.0, 8.0, 2.0, 32.0, 8.0, 2.0, 4.0, 2.0, 1.0, 8.0, 0.0, 16.0, 8.0, 4.0];
    Config.operatorEnvelopeInverted = [false, false, false, false, false, false, false, false, false, true, true, true, false, false, false, false, false, false, false, false];
    Config.operatorFeedbackNames = [
        "1⟲",
        "2⟲",
        "3⟲",
        "4⟲",
        "1⟲ 2⟲",
        "3⟲ 4⟲",
        "1⟲ 2⟲ 3⟲ ",
        "2⟲ 3⟲ 4⟲ ",
        "1⟲ 2⟲ 3⟲ 4⟲ ",
        "1→2",
        "1→3",
        "1→4",
        "2→3",
        "2→4",
        "3→4",
        "1→3 2→4",
        "1→4 2→3",
        "1→2→3→4",
		"1🗘2",
		"1🗘3",
		"1🗘4",
		"2🗘3",
		"2🗘4",
		"3🗘4",
    ];
    Config.midiFeedbackNames = [
        "1",
        "2",
        "3",
        "4",
        "1 2",
        "3 4",
        "1 2 3",
        "2 3 4",
        "1 2 3 4",
        "1>2",
        "1>3",
        "1>4",
        "2>3",
        "2>4",
        "3>4",
        "1>3 2>4",
        "1>4 2>3",
        "1>2>3>4",
		"1-2",
		"1-3",
		"1-4",
		"2-3",
		"2-4",
		"3-4",
    ];
    Config.operatorFeedbackIndices = [
        [[1], [], [], []],
        [[], [2], [], []],
        [[], [], [3], []],
        [[], [], [], [4]],
        [[1], [2], [], []],
        [[], [], [3], [4]],
        [[1], [2], [3], []],
        [[], [2], [3], [4]],
        [[1], [2], [3], [4]],
        [[], [1], [], []],
        [[], [], [1], []],
        [[], [], [], [1]],
        [[], [], [2], []],
        [[], [], [], [2]],
        [[], [], [], [3]],
        [[], [], [1], [2]],
        [[], [], [2], [1]],
        [[], [1], [2], [3]],
        [[2], [1], [],  []  ],
        [[3], [],  [1], []  ],
        [[4], [],  [],  [1] ],
        [[],  [3], [2], []  ],
        [[],  [4], [],  [2] ],
        [[],  [],  [4], [3] ],
    ];
    Config.pitchChannelTypeNames =    ["chip", "FM (expert)", "PWM (beta)"];
	Config.drumChannelTypeNames =     ["noise"]
    Config.instrumentTypeNames =      ["chip", "FM", "noise", "PWM"];
    Config.pitchChannelColorsDim =    [channelOneDimColorPallet, channelTwoDimColorPallet, channelThreeDimColorPallet, channelFourDimColorPallet, channelFiveDimColorPallet, channelSixDimColorPallet, channelSevenDimColorPallet, channelEightDimColorPallet, channelNineDimColorPallet, channelTenDimColorPallet, channelElevenDimColorPallet, channelTwelveDimColorPallet];
    Config.pitchChannelColorsBright = [channelOneBrightColorPallet, channelTwoBrightColorPallet, channelThreeBrightColorPallet, channelFourBrightColorPallet, channelFiveBrightColorPallet, channelSixBrightColorPallet, channelSevenBrightColorPallet, channelEightBrightColorPallet, channelNineBrightColorPallet, channelTenBrightColorPallet, channelElevenBrightColorPallet, channelTwelveBrightColorPallet];
    Config.pitchNoteColorsDim =       [channelOneDimColorPallet, channelTwoDimColorPallet, channelThreeDimColorPallet, channelFourDimColorPallet, channelFiveDimColorPallet, channelSixDimColorPallet, channelSevenDimColorPallet, channelEightDimColorPallet, channelNineDimColorPallet, channelTenDimColorPallet, channelElevenDimColorPallet, channelTwelveDimColorPallet];
    Config.pitchNoteColorsBright =    [channelOneBrightColorPallet, channelTwoBrightColorPallet, channelThreeBrightColorPallet, channelFourBrightColorPallet, channelFiveBrightColorPallet, channelSixBrightColorPallet, channelSevenBrightColorPallet, channelEightBrightColorPallet, channelNineBrightColorPallet, channelTenBrightColorPallet, channelElevenBrightColorPallet, channelTwelveBrightColorPallet];
    Config.drumChannelColorsDim =     [channelThirteenDimColorPallet, channelFourteenDimColorPallet, channelFifteenDimColorPallet, channelSixteenDimColorPallet];
    Config.drumChannelColorsBright =  [channelThirteenBrightColorPallet, channelFourteenBrightColorPallet, channelFifteenBrightColorPallet, channelSixteenBrightColorPallet];
    Config.drumNoteColorsDim =        [channelThirteenDimColorPallet, channelFourteenDimColorPallet, channelFifteenDimColorPallet, channelSixteenDimColorPallet];
    Config.drumNoteColorsBright =     [channelThirteenBrightColorPallet, channelFourteenBrightColorPallet, channelFifteenBrightColorPallet, channelSixteenBrightColorPallet];
	Config.settNoteColorsDim =        ["#991010"];
    Config.settNoteColorsBright =     ["#ffffff", "#00ff00", "#42dcff", "#ffff25", "#4449a3", "#f6ff00", "#000000", "#fdd01d", "#69c400", "#fffc5b", "#66bf39", "#fefe00", "#75093e", "#818383", "#8bac0f", "#ffedca", "#000000", "#ffffff", "#ffffff"];
    Config.midiPitchChannelNames =    ["cyan channel", "yellow channel", "orange channel", "green channel", "purple channel", "blue channel"];
    Config.midiDrumChannelNames =     ["gray channel", "brown channel", "indigo channel"];
    Config.midiSustainInstruments = [
        0x47,
        0x50,
        0x46,
        0x44,
        0x51,
        0x51,
        0x51,
        0x51,
        0x4A,
    ];
    Config.midiDecayInstruments = [
        0x2E,
        0x2E,
        0x06,
        0x18,
        0x19,
        0x19,
        0x6A,
        0x6A,
        0x21,
    ];
	
    Config.drumInterval = 6;
    Config.drumCount = 12;
    Config.pitchCount = 37;
    Config.maxPitch = 84;
    Config.pitchChannelCountMin = 0;
    Config.pitchChannelCountMax = 12;
    Config.drumChannelCountMin = 0;
    Config.drumChannelCountMax = 4;
    Config.volBendMin = 3;
    Config.volBendMax = 5;
    Config.waves = [
        Config._centerWave([1.0 / 15.0, 3.0 / 15.0, 5.0 / 15.0, 7.0 / 15.0, 9.0 / 15.0, 11.0 / 15.0, 13.0 / 15.0, 15.0 / 15.0, 15.0 / 15.0, 13.0 / 15.0, 11.0 / 15.0, 9.0 / 15.0, 7.0 / 15.0, 5.0 / 15.0, 3.0 / 15.0, 1.0 / 15.0, -1.0 / 15.0, -3.0 / 15.0, -5.0 / 15.0, -7.0 / 15.0, -9.0 / 15.0, -11.0 / 15.0, -13.0 / 15.0, -15.0 / 15.0, -15.0 / 15.0, -13.0 / 15.0, -11.0 / 15.0, -9.0 / 15.0, -7.0 / 15.0, -5.0 / 15.0, -3.0 / 15.0, -1.0 / 15.0]),
        Config._centerWave([1.0, -1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0 / 31.0, 3.0 / 31.0, 5.0 / 31.0, 7.0 / 31.0, 9.0 / 31.0, 11.0 / 31.0, 13.0 / 31.0, 15.0 / 31.0, 17.0 / 31.0, 19.0 / 31.0, 21.0 / 31.0, 23.0 / 31.0, 25.0 / 31.0, 27.0 / 31.0, 29.0 / 31.0, 31.0 / 31.0, -31.0 / 31.0, -29.0 / 31.0, -27.0 / 31.0, -25.0 / 31.0, -23.0 / 31.0, -21.0 / 31.0, -19.0 / 31.0, -17.0 / 31.0, -15.0 / 31.0, -13.0 / 31.0, -11.0 / 31.0, -9.0 / 31.0, -7.0 / 31.0, -5.0 / 31.0, -3.0 / 31.0, -1.0 / 31.0]),
        Config._centerWave([0.0, -0.2, -0.4, -0.6, -0.8, -1.0, 1.0, -0.8, -0.6, -0.4, -0.2, 1.0, 0.8, 0.6, 0.4, 0.2]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, -1.0, 1.0, -1.0, 1.0, 0.0]),
        Config._centerWave([0.0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.2, 0.0, -0.2, -0.4, -0.5, -0.6, -0.7, -0.8, -0.85, -0.9, -0.95, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -0.95, -0.9, -0.85, -0.8, -0.7, -0.6, -0.5, -0.4, -0.2]),
		Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0,1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0]),
		Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
		Config._centerWave([0.0, 0.1875, 0.3125, 0.5625, 0.5, 0.75, 0.875, 1.0, 1.0, 0.6875, 0.5, 0.625, 0.625, 0.5, 0.375, 0.5625, 0.4375, 0.5625, 0.4375, 0.4375, 0.3125, 0.1875, 0.1875, 0.375, 0.5625, 0.5625, 0.5625, 0.5625, 0.5625, 0.4375, 0.25, 0.0]),
		Config._centerWave([1.0, 0.7, 0.1, 0.1, 0, 0, 0, 0, 0, 0.1, 0.2, 0.15, 0.25, 0.125, 0.215, 0.345, 4.0]),
		Config._centerWave([1.0 / 15.0, 3.0 / 15.0, 5.0 / 15.0, 9.0, 0.06]),
		Config._centerWave([-0.5, 3.5, 3.0, -0.5, -0.25, -1.0]),
		Config._centerWave([0.0, 0.05, 0.125, 0.2, 0.25, 0.3, 0.425, 0.475, 0.525, 0.625, 0.675, 0.725, 0.775, 0.8, 0.825, 0.875, 0.9, 0.925, 0.95, 0.975, 0.98, 0.99, 0.995, 1, 0.995, 0.99, 0.98, 0.975, 0.95, 0.925, 0.9, 0.875, 0.825, 0.8, 0.775, 0.725, 0.675, 0.625, 0.525, 0.475, 0.425, 0.3, 0.25, 0.2, 0.125, 0.05, 0.0, -0.05, -0.125, -0.2, -0.25, -0.3, -0.425, -0.475, -0.525, -0.625, -0.675, -0.725, -0.775, -0.8, -0.825, -0.875, -0.9, -0.925, -0.95, -0.975, -0.98, -0.99, -0.995, -1, -0.995, -0.99, -0.98, -0.975, -0.95, -0.925, -0.9, -0.875, -0.825, -0.8, -0.775, -0.725, -0.675, -0.625, -0.525, -0.475, -0.425, -0.3, -0.25, -0.2, -0.125, -0.05]),
		Config._centerWave([1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0]),
		Config._centerWave([0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]),
		Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
		Config._centerWave([1.0, 1.0 / 2.0, 1.0 / 3.0, 1.0 / 4.0]),
		Config._centerWave([-0.9, -1.0, -0.85, -0.775, -0.7, -0.6, -0.5, -0.4, -0.325, -0.225, -0.2, -0.125, -0.1, -0.11, -0.125, -0.15, -0.175, -0.18, -0.2, -0.21, -0.22, -0.21, -0.2, -0.175, -0.15, -0.1, -0.5, 0.75, 0.11, 0.175, 0.2, 0.25, 0.26, 0.275, 0.26, 0.25, 0.225, 0.2, 0.19, 0.18, 0.19, 0.2, 0.21, 0.22, 0.23, 0.24, 0.25, 0.26, 0.275, 0.28, 0.29, 0.3, 0.29, 0.28, 0.27, 0.26, 0.25, 0.225, 0.2, 0.175, 0.15, 0.1, 0.075, 0.0, -0.01, -0.025, 0.025, 0.075, 0.2, 0.3, 0.475, 0.6, 0.75, 0.85, 0.85, 1.0, 0.99, 0.95, 0.8, 0.675, 0.475, 0.275, 0.01, -0.15, -0.3, -0.475, -0.5, -0.6, -0.71, -0.81, -0.9, -1.0, -0.9]),
		Config._centerWave([-1.0, -0.95, -0.975, -0.9, -0.85, -0.8, -0.775, -0.65, -0.6, -0.5, -0.475, -0.35, -0.275, -0.2, -0.125, -0.05, 0.0, 0.075, 0.125, 0.15, 0.20, 0.21, 0.225, 0.25, 0.225, 0.21, 0.20, 0.19, 0.175, 0.125, 0.10, 0.075, 0.06, 0.05, 0.04, 0.025, 0.04, 0.05, 0.10, 0.15, 0.225, 0.325, 0.425, 0.575, 0.70, 0.85, 0.95, 1.0, 0.9, 0.675, 0.375, 0.2, 0.275, 0.4, 0.5, 0.55, 0.6, 0.625, 0.65, 0.65, 0.65, 0.65, 0.64, 0.6, 0.55, 0.5, 0.4, 0.325, 0.25, 0.15, 0.05, -0.05, -0.15, -0.275, -0.35, -0.45, -0.55, -0.65, -0.7, -0.78, -0.825, -0.9, -0.925, -0.95, -0.975]),
		Config._centerWave([1.0, 0.0, 0.1, -0.1, -0.2, -0.4, -0.3, -1.0]),
		Config._centerWave([1.0, -1.0, 4.0, 2.15, 4.13, 5.15, 0.0, -0.05, 1.0]),
		Config._centerWave([6.1, -2.9, 1.4, -2.9]),
		Config._centerWave([1, 4, 2, 1, -0.1, -1, -0.12]),
		Config._centerWave([0.2, 1.0, 2.6, 1.0, 0.0, -2.4]),
		Config._centerWave([1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]),
		Config._centerWave([1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0]),
		Config._centerWave([1.0, -0.9, 0.8, -0.7, 0.6, -0.5, 0.4, -0.3, 0.2, -0.1, 0.0, -0.1, 0.2, -0.3, 0.4, -0.5, 0.6, -0.7, 0.8, -0.9, 1.0]),
		];
    Config.wavesMixC = [
        Config._centerWave([1.0 / 15.0, 3.0 / 15.0, 5.0 / 15.0, 7.0 / 15.0, 9.0 / 15.0, 11.0 / 15.0, 13.0 / 15.0, 15.0 / 15.0, 15.0 / 15.0, 13.0 / 15.0, 11.0 / 15.0, 9.0 / 15.0, 7.0 / 15.0, 5.0 / 15.0, 3.0 / 15.0, 1.0 / 15.0, -1.0 / 15.0, -3.0 / 15.0, -5.0 / 15.0, -7.0 / 15.0, -9.0 / 15.0, -11.0 / 15.0, -13.0 / 15.0, -15.0 / 15.0, -15.0 / 15.0, -13.0 / 15.0, -11.0 / 15.0, -9.0 / 15.0, -7.0 / 15.0, -5.0 / 15.0, -3.0 / 15.0, -1.0 / 15.0]),
        Config._centerWave([1.0, -1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0 / 31.0, 3.0 / 31.0, 5.0 / 31.0, 7.0 / 31.0, 9.0 / 31.0, 11.0 / 31.0, 13.0 / 31.0, 15.0 / 31.0, 17.0 / 31.0, 19.0 / 31.0, 21.0 / 31.0, 23.0 / 31.0, 25.0 / 31.0, 27.0 / 31.0, 29.0 / 31.0, 31.0 / 31.0, -31.0 / 31.0, -29.0 / 31.0, -27.0 / 31.0, -25.0 / 31.0, -23.0 / 31.0, -21.0 / 31.0, -19.0 / 31.0, -17.0 / 31.0, -15.0 / 31.0, -13.0 / 31.0, -11.0 / 31.0, -9.0 / 31.0, -7.0 / 31.0, -5.0 / 31.0, -3.0 / 31.0, -1.0 / 31.0]),
        Config._centerWave([0.0, -0.2, -0.4, -0.6, -0.8, -1.0, 1.0, -0.8, -0.6, -0.4, -0.2, 1.0, 0.8, 0.6, 0.4, 0.2]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, -1.0, 1.0, -1.0, 1.0, 0.0]),
        Config._centerWave([0.0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.4, 0.2, 0.0, -0.2, -0.4, -0.5, -0.6, -0.7, -0.8, -0.85, -0.9, -0.95, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -0.95, -0.9, -0.85, -0.8, -0.7, -0.6, -0.5, -0.4, -0.2]),
		Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0,1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0]),
		Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
		Config._centerWave([0.0, 0.1875, 0.3125, 0.5625, 0.5, 0.75, 0.875, 1.0, 1.0, 0.6875, 0.5, 0.625, 0.625, 0.5, 0.375, 0.5625, 0.4375, 0.5625, 0.4375, 0.4375, 0.3125, 0.1875, 0.1875, 0.375, 0.5625, 0.5625, 0.5625, 0.5625, 0.5625, 0.4375, 0.25, 0.0]),
		Config._centerWave([1.0, 0.7, 0.1, 0.1, 0, 0, 0, 0, 0, 0.1, 0.2, 0.15, 0.25, 0.125, 0.215, 0.345, 4.0]),
		Config._centerWave([1.0 / 15.0, 3.0 / 15.0, 5.0 / 15.0, 9.0, 0.06]),
		Config._centerWave([-0.5, 3.5, 3.0, -0.5, -0.25, -1.0]),
		Config._centerWave([0.0, 0.05, 0.125, 0.2, 0.25, 0.3, 0.425, 0.475, 0.525, 0.625, 0.675, 0.725, 0.775, 0.8, 0.825, 0.875, 0.9, 0.925, 0.95, 0.975, 0.98, 0.99, 0.995, 1, 0.995, 0.99, 0.98, 0.975, 0.95, 0.925, 0.9, 0.875, 0.825, 0.8, 0.775, 0.725, 0.675, 0.625, 0.525, 0.475, 0.425, 0.3, 0.25, 0.2, 0.125, 0.05, 0.0, -0.05, -0.125, -0.2, -0.25, -0.3, -0.425, -0.475, -0.525, -0.625, -0.675, -0.725, -0.775, -0.8, -0.825, -0.875, -0.9, -0.925, -0.95, -0.975, -0.98, -0.99, -0.995, -1, -0.995, -0.99, -0.98, -0.975, -0.95, -0.925, -0.9, -0.875, -0.825, -0.8, -0.775, -0.725, -0.675, -0.625, -0.525, -0.475, -0.425, -0.3, -0.25, -0.2, -0.125, -0.05]),
		Config._centerWave([1.0, 1.0, 1.0, 1.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0]),
		Config._centerWave([0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]),
		Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
		Config._centerWave([1.0, 1.0 / 2.0, 1.0 / 3.0, 1.0 / 4.0]),
		Config._centerWave([-0.9, -1.0, -0.85, -0.775, -0.7, -0.6, -0.5, -0.4, -0.325, -0.225, -0.2, -0.125, -0.1, -0.11, -0.125, -0.15, -0.175, -0.18, -0.2, -0.21, -0.22, -0.21, -0.2, -0.175, -0.15, -0.1, -0.5, 0.75, 0.11, 0.175, 0.2, 0.25, 0.26, 0.275, 0.26, 0.25, 0.225, 0.2, 0.19, 0.18, 0.19, 0.2, 0.21, 0.22, 0.23, 0.24, 0.25, 0.26, 0.275, 0.28, 0.29, 0.3, 0.29, 0.28, 0.27, 0.26, 0.25, 0.225, 0.2, 0.175, 0.15, 0.1, 0.075, 0.0, -0.01, -0.025, 0.025, 0.075, 0.2, 0.3, 0.475, 0.6, 0.75, 0.85, 0.85, 1.0, 0.99, 0.95, 0.8, 0.675, 0.475, 0.275, 0.01, -0.15, -0.3, -0.475, -0.5, -0.6, -0.71, -0.81, -0.9, -1.0, -0.9]),
		Config._centerWave([-1.0, -0.95, -0.975, -0.9, -0.85, -0.8, -0.775, -0.65, -0.6, -0.5, -0.475, -0.35, -0.275, -0.2, -0.125, -0.05, 0.0, 0.075, 0.125, 0.15, 0.20, 0.21, 0.225, 0.25, 0.225, 0.21, 0.20, 0.19, 0.175, 0.125, 0.10, 0.075, 0.06, 0.05, 0.04, 0.025, 0.04, 0.05, 0.10, 0.15, 0.225, 0.325, 0.425, 0.575, 0.70, 0.85, 0.95, 1.0, 0.9, 0.675, 0.375, 0.2, 0.275, 0.4, 0.5, 0.55, 0.6, 0.625, 0.65, 0.65, 0.65, 0.65, 0.64, 0.6, 0.55, 0.5, 0.4, 0.325, 0.25, 0.15, 0.05, -0.05, -0.15, -0.275, -0.35, -0.45, -0.55, -0.65, -0.7, -0.78, -0.825, -0.9, -0.925, -0.95, -0.975]),
		Config._centerWave([0.7, 0.0, 0.1, -0.1, -0.2, -0.4, -0.3, -0.7]),
		Config._centerWave([1.0, -1.0, 4.0, 2.15, 4.1, 5.05, 0.0, -0.05, 1.0]),
		Config._centerWave([4.5, -1.7, 1.0, -1.7]),
		Config._centerWave([0.1, 0.4, 0.2, 0.1, -0.1, -1, -0.12]),
		Config._centerWave([.03, .13, .30, 1.0, 0.0, -.26]),
		Config._centerWave([2, 1.75, 1.5, 1.25, 1, .75, .5, .25, 0.0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]),
		Config._centerWave([1.0, 1.9, 1.8, 1.7, 1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0]),
		Config._centerWave([-1.0, -0.9, 0.8, -0.7, 0.6, -0.5, 0.4, -0.3, 0.2, -0.1, 0.0, -0.1, 0.2, -0.3, 0.4, -0.5, 0.6, -0.7, 0.8, -0.9, -1.0]),
		];
    Config.pwmwaves = [
		Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
		Config._centerWave([1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
		Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
		Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
		Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
        Config._centerWave([1.0, 1.0, 1.0, 1.0, 1.0, -1.0, -1.0, -1.0, -1.0, -1.0]),
		];
    Config.sineWaveLength = 1 << 8;
    Config.sineWaveMask = Config.sineWaveLength - 1;
    Config.sineWave = Config.generateSineWave();
    beepbox.Config = Config;
    var BitFieldReader = (function () {
        function BitFieldReader(base64CharCodeToInt, source, startIndex, stopIndex) {
            this._bits = [];
            this._readIndex = 0;
            for (var i = startIndex; i < stopIndex; i++) {
                var value = base64CharCodeToInt[source.charCodeAt(i)];
                this._bits.push((value >> 5) & 0x1);
                this._bits.push((value >> 4) & 0x1);
                this._bits.push((value >> 3) & 0x1);
                this._bits.push((value >> 2) & 0x1);
                this._bits.push((value >> 1) & 0x1);
                this._bits.push(value & 0x1);
            }
        }
        BitFieldReader.prototype.read = function (bitCount) {
            var result = 0;
            while (bitCount > 0) {
                result = result << 1;
                result += this._bits[this._readIndex++];
                bitCount--;
            }
            return result;
        };
        BitFieldReader.prototype.readLongTail = function (minValue, minBits) {
            var result = minValue;
            var numBits = minBits;
            while (this._bits[this._readIndex++]) {
                result += 1 << numBits;
                numBits++;
            }
            while (numBits > 0) {
                numBits--;
                if (this._bits[this._readIndex++]) {
                    result += 1 << numBits;
                }
            }
            return result;
        };
        BitFieldReader.prototype.readPartDuration = function () {
            return this.readLongTail(1, 2);
        };
        BitFieldReader.prototype.readPinCount = function () {
            return this.readLongTail(1, 0);
        };
        BitFieldReader.prototype.readPitchInterval = function () {
            if (this.read(1)) {
                return -this.readLongTail(1, 3);
            }
            else {
                return this.readLongTail(1, 3);
            }
        };
        return BitFieldReader;
    }());
    var BitFieldWriter = (function () {
        function BitFieldWriter() {
            this._bits = [];
        }
        BitFieldWriter.prototype.write = function (bitCount, value) {
            bitCount--;
            while (bitCount >= 0) {
                this._bits.push((value >>> bitCount) & 1);
                bitCount--;
            }
        };
        BitFieldWriter.prototype.writeLongTail = function (minValue, minBits, value) {
            if (value < minValue)
                throw new Error("value out of bounds");
            value -= minValue;
            var numBits = minBits;
            while (value >= (1 << numBits)) {
                this._bits.push(1);
                value -= 1 << numBits;
                numBits++;
            }
            this._bits.push(0);
            while (numBits > 0) {
                numBits--;
                this._bits.push((value >>> numBits) & 1);
            }
        };
        BitFieldWriter.prototype.writePartDuration = function (value) {
            this.writeLongTail(1, 2, value);
        };
        BitFieldWriter.prototype.writePinCount = function (value) {
            this.writeLongTail(1, 0, value);
        };
        BitFieldWriter.prototype.writePitchInterval = function (value) {
            if (value < 0) {
                this.write(1, 1);
                this.writeLongTail(1, 3, -value);
            }
            else {
                this.write(1, 0);
                this.writeLongTail(1, 3, value);
            }
        };
        BitFieldWriter.prototype.concat = function (other) {
            this._bits = this._bits.concat(other._bits);
        };
        BitFieldWriter.prototype.encodeBase64 = function (base64IntToCharCode, buffer) {
            for (var i = 0; i < this._bits.length; i += 6) {
                var value = (this._bits[i] << 5) | (this._bits[i + 1] << 4) | (this._bits[i + 2] << 3) | (this._bits[i + 3] << 2) | (this._bits[i + 4] << 1) | this._bits[i + 5];
                buffer.push(base64IntToCharCode[value]);
            }
            return buffer;
        };
        BitFieldWriter.prototype.lengthBase64 = function () {
            return Math.ceil(this._bits.length / 6);
        };
        return BitFieldWriter;
    }());
    function makeNotePin(interval, time, volume) {
        return { interval: interval, time: time, volume: volume };
    }
    beepbox.makeNotePin = makeNotePin;
    function makeNote(pitch, start, end, volume, fadeout) {
        if (fadeout === void 0) { fadeout = false; }
        return {
            pitches: [pitch],
            pins: [makeNotePin(0, 0, volume), makeNotePin(0, end - start, fadeout ? 0 : volume)],
            start: start,
            end: end,
        };
    }
    beepbox.makeNote = makeNote;
    var Pattern = (function () {
        function Pattern() {
            this.notes = [];
            this.instrument = 0;
        }
        Pattern.prototype.cloneNotes = function () {
            var result = [];
            for (var _i = 0, _a = this.notes; _i < _a.length; _i++) {
                var oldNote = _a[_i];
                var newNote = makeNote(-1, oldNote.start, oldNote.end, 3);
                newNote.pitches = oldNote.pitches.concat();
                newNote.pins = [];
                for (var _b = 0, _c = oldNote.pins; _b < _c.length; _b++) {
                    var oldPin = _c[_b];
                    newNote.pins.push(makeNotePin(oldPin.interval, oldPin.time, oldPin.volume));
                }
                result.push(newNote);
            }
            return result;
        };
        Pattern.prototype.reset = function () {
            this.notes.length = 0;
            this.instrument = 0;
        };
        return Pattern;
    }());
    beepbox.Pattern = Pattern;
    function cloneNoteArray(notes) {
        var result = [];
        for (var _i = 0, notes_1 = notes; _i < notes_1.length; _i++) {
            var oldNote = notes_1[_i];
            var newNote = makeNote(-1, oldNote.start, oldNote.end, 3);
            newNote.pitches = oldNote.pitches.concat();
            newNote.pins = [];
            for (var _a = 0, _b = oldNote.pins; _a < _b.length; _a++) {
                var oldPin = _b[_a];
                newNote.pins.push(makeNotePin(oldPin.interval, oldPin.time, oldPin.volume));
            }
            result.push(newNote);
        }
        return result;
    }
    beepbox.cloneNoteArray = cloneNoteArray;
    var Operator = (function () {
        function Operator(index) {
            this.frequency = 0;
            this.amplitude = 0;
            this.envelope = 0;
            this.reset(index);
        }
        Operator.prototype.reset = function (index) {
            this.frequency = 0;
            this.amplitude = (index <= 1) ? Config.operatorAmplitudeMax : 0;
            this.envelope = 1;
        };
        Operator.prototype.copy = function (other) {
            this.frequency = other.frequency;
            this.amplitude = other.amplitude;
            this.envelope = other.envelope;
        };
        return Operator;
    }());
    beepbox.Operator = Operator;
    var Instrument = (function () {
        function Instrument() {
            this.type = 0;
            this.wave = 1;
            this.filter = 1;
            this.transition = 1;
            this.effect = 0;
			this.harm = 0;
			this.fmChorus = 1;
			this.imute = 0;
			this.octoff = 0;
            this.chorus = 0;
            this.volume = 0;
			this.ipan = 4;
            this.algorithm = 0;
            this.feedbackType = 0;
            this.feedbackAmplitude = 0;
            this.feedbackEnvelope = 1;
            this.operators = [];
            for (var i = 0; i < Config.operatorCount; i++) {
                this.operators.push(new Operator(i));
            }
            Object.defineProperty(this, "muteState", {
                get: function () { return this.imute; },
                set: function (value) { this.imute = value; },
                configurable: true,
                enumerable: true,
            });
            Object.defineProperty(this, "octaveOffset", {
                get: function () { return this.octoff; },
                set: function (value) { this.octoff = value; },
                configurable: true,
                enumerable: true,
            });
            Object.defineProperty(this, "pan", {
                get: function () { return this.ipan; },
                set: function (value) { this.ipan = value; },
                configurable: true,
                enumerable: true,
            });
        }
        Instrument.prototype.reset = function () {
            this.type = 0;
            this.wave = 1;
            this.filter = 1;
            this.transition = 1;
            this.effect = 0;
			this.harm = 0;
			this.fmChorus = 1;
			this.imute = 0;
			this.ipan = 4;
			this.octoff = 0;
            this.chorus = 0;
            this.volume = 0;
            this.algorithm = 0;
            this.feedbackType = 0;
            this.feedbackAmplitude = 0;
            this.feedbackEnvelope = 1;
            for (var i = 0; i < this.operators.length; i++) {
                this.operators[i].reset(i);
            }
        };
        Instrument.prototype.setTypeAndReset = function (type) {
            this.type = type;
            switch (type) {
                case 0:
                    this.wave = 1;
                    this.filter = 1;
                    this.transition = 1;
                    this.effect = 0;
					this.harm = 0;
					this.imute = 0;
					this.ipan = 4;
					this.octoff = 0;
                    this.chorus = 0;
                    this.volume = 0;
                    break;
                case 1:
                    this.wave = 1;
                    this.transition = 1;
                    this.volume = 0;
					this.imute = 0;
					this.ipan = 4;
					this.harm = 0;
					this.octoff = 0;
                    break;
                case 2:
                    this.transition = 1;
					this.octoff = 0;
					this.fmChorus = 1;
					this.ipan = 4;
                    this.effect = 0;
                    this.algorithm = 0;
                    this.feedbackType = 0;
                    this.feedbackAmplitude = 0;
                    this.feedbackEnvelope = 1;
					this.volume = 0;
                    for (var i = 0; i < this.operators.length; i++) {
                        this.operators[i].reset(i);
                    }
                    break;
                case 3:
                    this.wave = 1;
                    this.filter = 1;
                    this.transition = 1;
                    this.effect = 0;
					this.harm = 0;
					this.imute = 0;
					this.ipan = 4;
					this.octoff = 0;
                    this.chorus = 0;
                    this.volume = 0;
                    break;
            }
        };
        Instrument.prototype.copy = function (other) {
            this.type = other.type;
            this.wave = other.wave;
            this.filter = other.filter;
            this.transition = other.transition;
            this.effect = other.effect;
            this.chorus = other.chorus;
            this.volume = other.volume;
			this.harm = other.harm;
			this.fmChorus = other.fmChorus;
			this.imute = other.imute;
			this.ipan = other.ipan;
			this.octoff = other.octoff;
            this.algorithm = other.algorithm;
            this.feedbackType = other.feedbackType;
            this.feedbackAmplitude = other.feedbackAmplitude;
            this.feedbackEnvelope = other.feedbackEnvelope;
            for (var i = 0; i < this.operators.length; i++) {
                this.operators[i].copy(other.operators[i]);
            }
        };
        return Instrument;
    }());
    beepbox.Instrument = Instrument;
    var Channel = (function () {
        function Channel() {
            this.octave = 0;
            this.instruments = [];
            this.patterns = [];
            this.bars = [];
        }
        return Channel;
    }());
    beepbox.Channel = Channel;
    var Song = (function () {
        function Song(string) {
            this.channels = [];
            this._fingerprint = [];
            if (string != undefined) {
                this.fromBase64String(string);
            }
            else {
                this.initToDefault(true);
            }
        }
        Song.prototype.getChannelCount = function () {
            return this.pitchChannelCount + this.drumChannelCount;
        };
        Song.prototype.getChannelUnusedCount = function () {
            return ((Config.pitchChannelCountMax + Config.drumChannelCountMax) - (this.pitchChannelCount + this.drumChannelCount));
        };
        Song.prototype.getThemeName = function () {
            return (Config.themeNames[this.theme]);
        }; 
        Song.prototype.getTimeSig = function () {
            return ((this.beatsPerBar) + '/' + (this.partsPerBeat) + ' with ' + (this.barCount) + ' bars.');
        };
        Song.prototype.getScaleNKey = function () {
            return (' "' +(Config.scaleNames[this.scale]) + '" and your key is ' + (Config.keyNames[this.key]));
        };
        Song.prototype.getChannelIsDrum = function (channel) {
            return (channel >= this.pitchChannelCount);
        };
        Song.prototype.getChannelColorDim = function (channel) {
            return channel < this.pitchChannelCount ? Config.pitchChannelColorsDim[channel] : Config.drumChannelColorsDim[channel - this.pitchChannelCount];
        };
        Song.prototype.getChannelColorBright = function (channel) {
            return channel < this.pitchChannelCount ? Config.pitchChannelColorsBright[channel] : Config.drumChannelColorsBright[channel - this.pitchChannelCount];
        };
        Song.prototype.getNoteColorDim = function (channel) {
            return channel < this.pitchChannelCount ? Config.pitchNoteColorsDim[channel] : Config.drumNoteColorsDim[channel - this.pitchChannelCount];
        };
        Song.prototype.getNoteColorBright = function (channel) {
            return channel < this.pitchChannelCount ? Config.pitchNoteColorsBright[channel] : Config.drumNoteColorsBright[channel - this.pitchChannelCount];
        };
        Song.prototype.getVolBend = function () {
            return this.volBendCount;
        }; 
        Song.prototype.initToDefault = function (andResetChannels) {
            if (andResetChannels === void 0) { andResetChannels = true; }
            this.scale = 0;
			this.theme = 0;
            this.key = Config.keyNames.length - 1;
			this.mix = 0;
			this.sampleRate = 2;
            this.loopStart = 0;
            this.loopLength = 4;
            this.tempo = 7;
            this.reverb = 0;
            this.blend = 0;
            this.riff = 0;
			this.detune = 0;
			this.muff = 0;
            this.beatsPerBar = 8;
            this.barCount = 16;
            this.patternsPerChannel = 8;
            this.partsPerBeat = 4;
            this.volBendCount = 4;
            this.instrumentsPerChannel = 1;
            if (andResetChannels) {
                this.pitchChannelCount = 4;
                this.drumChannelCount = 1;
                for (var channelIndex = 0; channelIndex < this.getChannelCount(); channelIndex++) {
                    if (this.channels.length <= channelIndex) {
                        this.channels[channelIndex] = new Channel();
                    }
                    var channel = this.channels[channelIndex];
                    channel.octave = 4 - channelIndex;
                    for (var pattern = 0; pattern < this.patternsPerChannel; pattern++) {
                        if (channel.patterns.length <= pattern) {
                            channel.patterns[pattern] = new Pattern();
                        }
                        else {
                            channel.patterns[pattern].reset();
                        }
                    }
                    channel.patterns.length = this.patternsPerChannel;
                    for (var instrument = 0; instrument < this.instrumentsPerChannel; instrument++) {
                        if (channel.instruments.length <= instrument) {
                            channel.instruments[instrument] = new Instrument();
                        }
                        else {
                            channel.instruments[instrument].reset();
                        }
                    }
                    channel.instruments.length = this.instrumentsPerChannel;
                    for (var bar = 0; bar < this.barCount; bar++) {
                        channel.bars[bar] = 0;
                    }
                    channel.bars.length = this.barCount;
                }
                this.channels.length = this.getChannelCount();
            }
        };
        Song.prototype.toBase64String = function () {
            var bits;
            var buffer = [];
            var base64IntToCharCode = Song._base64IntToCharCode;
            buffer.push(base64IntToCharCode[Song._latestVersion]);
            buffer.push(110, base64IntToCharCode[this.pitchChannelCount], base64IntToCharCode[this.drumChannelCount]);
            buffer.push(122, base64IntToCharCode[this.theme]);
			buffer.push(115, base64IntToCharCode[this.scale]);
			buffer.push(117, base64IntToCharCode[this.mix]);
			buffer.push(124, base64IntToCharCode[this.sampleRate]);
            buffer.push(107, base64IntToCharCode[this.key]);
            buffer.push(108, base64IntToCharCode[this.loopStart >> 6], base64IntToCharCode[this.loopStart & 0x3f]);
            buffer.push(101, base64IntToCharCode[(this.loopLength - 1) >> 6], base64IntToCharCode[(this.loopLength - 1) & 0x3f]);
            buffer.push(116, base64IntToCharCode[this.tempo]);
            buffer.push(109, base64IntToCharCode[this.reverb]);
            buffer.push(120, base64IntToCharCode[this.blend]);
            buffer.push(121, base64IntToCharCode[this.riff]);
			buffer.push(72, base64IntToCharCode[this.detune]);
			buffer.push(36, base64IntToCharCode[this.muff]);
            buffer.push(97, base64IntToCharCode[this.beatsPerBar - 1]);
            buffer.push(103, base64IntToCharCode[(this.barCount - 1) >> 6], base64IntToCharCode[(this.barCount - 1) & 0x3f]);
            buffer.push(106, base64IntToCharCode[this.patternsPerChannel - 1]);
            buffer.push(105, base64IntToCharCode[this.instrumentsPerChannel - 1]);
            buffer.push(114, base64IntToCharCode[Config.partCounts.indexOf(this.partsPerBeat)]);
            buffer.push(111);
            for (var channel = 0; channel < this.getChannelCount(); channel++) {
                buffer.push(base64IntToCharCode[this.channels[channel].octave]);
            }
            for (var channel = 0; channel < this.getChannelCount(); channel++) {
                for (var i = 0; i < this.instrumentsPerChannel; i++) {
                    var instrument = this.channels[channel].instruments[i];
                    if (channel < this.pitchChannelCount) {
                        buffer.push(84, base64IntToCharCode[instrument.type]);
                        if (instrument.type == 0) {
                            buffer.push(119, base64IntToCharCode[instrument.wave]);
                            buffer.push(102, base64IntToCharCode[instrument.filter]);
                            buffer.push(100, base64IntToCharCode[instrument.transition]);
                            buffer.push(99, base64IntToCharCode[instrument.effect]);
							buffer.push(113, base64IntToCharCode[instrument.harm]);
							buffer.push(71, base64IntToCharCode[instrument.imute]);
							buffer.push(76, base64IntToCharCode[instrument.ipan]);
							buffer.push(66, base64IntToCharCode[instrument.octoff]);
                            buffer.push(104, base64IntToCharCode[instrument.chorus]);
                            buffer.push(118, base64IntToCharCode[instrument.volume]);
                        }
                        else if (instrument.type == 1) {
                            buffer.push(100, base64IntToCharCode[instrument.transition]);
                            buffer.push(99, base64IntToCharCode[instrument.effect]);
							buffer.push(66, base64IntToCharCode[instrument.octoff]);
							buffer.push(35, base64IntToCharCode[instrument.fmChorus]);
							buffer.push(76, base64IntToCharCode[instrument.ipan]);
                            buffer.push(65, base64IntToCharCode[instrument.algorithm]);
                            buffer.push(70, base64IntToCharCode[instrument.feedbackType]);
                            buffer.push(95, base64IntToCharCode[instrument.feedbackAmplitude]);
                            buffer.push(86, base64IntToCharCode[instrument.feedbackEnvelope]);
							buffer.push(118, base64IntToCharCode[instrument.volume]);
                            buffer.push(81);
                            for (var o = 0; o < Config.operatorCount; o++) {
                                buffer.push(base64IntToCharCode[instrument.operators[o].frequency]);
                            }
                            buffer.push(80);
                            for (var o = 0; o < Config.operatorCount; o++) {
                                buffer.push(base64IntToCharCode[instrument.operators[o].amplitude]);
                            }
                            buffer.push(69);
                            for (var o = 0; o < Config.operatorCount; o++) {
                                buffer.push(base64IntToCharCode[instrument.operators[o].envelope]);
                            }
						}
                        else if (instrument.type == 2) {
                            buffer.push(119, base64IntToCharCode[instrument.wave]);
                            buffer.push(102, base64IntToCharCode[instrument.filter]);
                            buffer.push(100, base64IntToCharCode[instrument.transition]);
                            buffer.push(99, base64IntToCharCode[instrument.effect]);
							buffer.push(113, base64IntToCharCode[instrument.harm]);
							buffer.push(71, base64IntToCharCode[instrument.imute]);
							buffer.push(76, base64IntToCharCode[instrument.ipan]);
							buffer.push(66, base64IntToCharCode[instrument.octoff]);
                            buffer.push(104, base64IntToCharCode[instrument.chorus]);
                            buffer.push(118, base64IntToCharCode[instrument.volume]);
                            }
                        else {
                            throw new Error("Unknown instrument type.");
                        }
                    }
                    else {
						buffer.push(84, base64IntToCharCode[2]);
                        buffer.push(119, base64IntToCharCode[instrument.wave]);
                        buffer.push(100, base64IntToCharCode[instrument.transition]);
                        buffer.push(118, base64IntToCharCode[instrument.volume]);
						buffer.push(71, base64IntToCharCode[instrument.imute]);
						buffer.push(113, base64IntToCharCode[instrument.harm]);
						buffer.push(66, base64IntToCharCode[instrument.octoff]);
						buffer.push(76, base64IntToCharCode[instrument.ipan]);
                    }
                }
            }
            buffer.push(98);
            bits = new BitFieldWriter();
            var neededBits = 0;
            while ((1 << neededBits) < this.patternsPerChannel + 1)
                neededBits++;
            for (var channel = 0; channel < this.getChannelCount(); channel++)
                for (var i = 0; i < this.barCount; i++) {
                    bits.write(neededBits, this.channels[channel].bars[i]);
                }
            bits.encodeBase64(base64IntToCharCode, buffer);
            buffer.push(112);
            bits = new BitFieldWriter();
            var neededInstrumentBits = 0;
            while ((1 << neededInstrumentBits) < this.instrumentsPerChannel)
                neededInstrumentBits++;
            for (var channel = 0; channel < this.getChannelCount(); channel++) {
                var isDrum = this.getChannelIsDrum(channel);
                var octaveOffset = isDrum ? 0 : this.channels[channel].octave * 12;
                var lastPitch = (isDrum ? 4 : 12) + octaveOffset;
                var recentPitches = isDrum ? [4, 6, 7, 2, 3, 8, 0, 10] : [12, 19, 24, 31, 36, 7, 0];
                var recentShapes = [];
                for (var i = 0; i < recentPitches.length; i++) {
                    recentPitches[i] += octaveOffset;
                }
                for (var _i = 0, _a = this.channels[channel].patterns; _i < _a.length; _i++) {
                    var p = _a[_i];
                    bits.write(neededInstrumentBits, p.instrument);
                    if (p.notes.length > 0) {
                        bits.write(1, 1);
                        var curPart = 0;
                        for (var _b = 0, _c = p.notes; _b < _c.length; _b++) {
                            var t = _c[_b];
                            if (t.start > curPart) {
                                bits.write(2, 0);
                                bits.writePartDuration(t.start - curPart);
                            }
                            var shapeBits = new BitFieldWriter();
                            for (var i = 1; i < t.pitches.length; i++)
                                shapeBits.write(1, 1);
                            if (t.pitches.length < 4)
                                shapeBits.write(1, 0);
                            shapeBits.writePinCount(t.pins.length - 1);
                            shapeBits.write(2, t.pins[0].volume);
                            var shapePart = 0;
                            var startPitch = t.pitches[0];
                            var currentPitch = startPitch;
                            var pitchBends = [];
                            for (var i = 1; i < t.pins.length; i++) {
                                var pin = t.pins[i];
                                var nextPitch = startPitch + pin.interval;
                                if (currentPitch != nextPitch) {
                                    shapeBits.write(1, 1);
                                    pitchBends.push(nextPitch);
                                    currentPitch = nextPitch;
                                }
                                else {
                                    shapeBits.write(1, 0);
                                }
                                shapeBits.writePartDuration(pin.time - shapePart);
                                shapePart = pin.time;
                                shapeBits.write(2, pin.volume);
                            }
                            var shapeString = String.fromCharCode.apply(null, shapeBits.encodeBase64(base64IntToCharCode, []));
                            var shapeIndex = recentShapes.indexOf(shapeString);
                            if (shapeIndex == -1) {
                                bits.write(2, 1);
                                bits.concat(shapeBits);
                            }
                            else {
                                bits.write(1, 1);
                                bits.writeLongTail(0, 0, shapeIndex);
                                recentShapes.splice(shapeIndex, 1);
                            }
                            recentShapes.unshift(shapeString);
                            if (recentShapes.length > 10)
                                recentShapes.pop();
                            var allPitches = t.pitches.concat(pitchBends);
                            for (var i = 0; i < allPitches.length; i++) {
                                var pitch = allPitches[i];
                                var pitchIndex = recentPitches.indexOf(pitch);
                                if (pitchIndex == -1) {
                                    var interval = 0;
                                    var pitchIter = lastPitch;
                                    if (pitchIter < pitch) {
                                        while (pitchIter != pitch) {
                                            pitchIter++;
                                            if (recentPitches.indexOf(pitchIter) == -1)
                                                interval++;
                                        }
                                    }
                                    else {
                                        while (pitchIter != pitch) {
                                            pitchIter--;
                                            if (recentPitches.indexOf(pitchIter) == -1)
                                                interval--;
                                        }
                                    }
                                    bits.write(1, 0);
                                    bits.writePitchInterval(interval);
                                }
                                else {
                                    bits.write(1, 1);
                                    bits.write(3, pitchIndex);
                                    recentPitches.splice(pitchIndex, 1);
                                }
                                recentPitches.unshift(pitch);
                                if (recentPitches.length > 8)
                                    recentPitches.pop();
                                if (i == t.pitches.length - 1) {
                                    lastPitch = t.pitches[0];
                                }
                                else {
                                    lastPitch = pitch;
                                }
                            }
                            curPart = t.end;
                        }
                        if (curPart < this.beatsPerBar * this.partsPerBeat) {
                            bits.write(2, 0);
                            bits.writePartDuration(this.beatsPerBar * this.partsPerBeat - curPart);
                        }
                    }
                    else {
                        bits.write(1, 0);
                    }
                }
            }
            var stringLength = bits.lengthBase64();
            var digits = [];
            while (stringLength > 0) {
                digits.unshift(base64IntToCharCode[stringLength & 0x3f]);
                stringLength = stringLength >> 6;
            }
            buffer.push(base64IntToCharCode[digits.length]);
            Array.prototype.push.apply(buffer, digits);
            bits.encodeBase64(base64IntToCharCode, buffer);
            if (buffer.length >= 65535)
                throw new Error("Song hash code too long.");
            return String.fromCharCode.apply(null, buffer);
        };
        Song.prototype.fromBase64String = function (compressed) {
            if (compressed == null || compressed == "") {
                this.initToDefault(true);
                return;
            }
            var charIndex = 0;
            while (compressed.charCodeAt(charIndex) <= 32)
                charIndex++;
            if (compressed.charCodeAt(charIndex) == 35)
                charIndex++;
            if (compressed.charCodeAt(charIndex) == 123) {
                this.fromJsonObject(JSON.parse(charIndex == 0 ? compressed : compressed.substring(charIndex)));
                return;
            }
            var version = Song._base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
            if (version == -1 || version > Song._latestVersion || version < Song._oldestVersion)
                return;
            var beforeThree = version < 3;
            var beforeFour = version < 4;
            var beforeFive = version < 5;
            var beforeSix = version < 6;
			var beforeSeven = version < 7;
            var base64CharCodeToInt = Song._base64CharCodeToInt;
            this.initToDefault(beforeSeven);
            if (beforeThree) {
                for (var _i = 0, _a = this.channels; _i < _a.length; _i++) {
                    var channel = _a[_i];
                    channel.instruments[0].transition = 0;
                }
                this.channels[3].instruments[0].wave = 0;
            }
            var instrumentChannelIterator = 0;
            var instrumentIndexIterator = -1;
            while (charIndex < compressed.length) {
                var command = compressed.charCodeAt(charIndex++);
                var channel = void 0;
                if (command == 110) {
                    this.pitchChannelCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.drumChannelCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.pitchChannelCount = Song._clip(Config.pitchChannelCountMin, Config.pitchChannelCountMax + 1, this.pitchChannelCount);
                    this.drumChannelCount = Song._clip(Config.drumChannelCountMin, Config.drumChannelCountMax + 1, this.drumChannelCount);
                    for (var channelIndex = this.channels.length; channelIndex < this.getChannelCount(); channelIndex++) {
                        this.channels[channelIndex] = new Channel();
                    }
                    this.channels.length = this.getChannelCount();
                }
                else if (command == 115) {
                    this.scale = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    if (beforeThree && this.scale == 10)
                        this.scale = 11;
                }
                else if (command == 117) {
                    this.mix = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                }
                else if (command == 107) {
                    this.key = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                }
				else if (command == 122) {
                    this.theme = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                }
                else if (command == 108) {
                    if (beforeFive) {
                        this.loopStart = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                    else {
                        this.loopStart = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                }
                else if (command == 101) {
                    if (beforeFive) {
                        this.loopLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                    else {
                        this.loopLength = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                    }
                }
                else if (command == 116) {
                    if (beforeFour) {
                        this.tempo = [1, 4, 7, 10][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
                    }
                    else {
                        this.tempo = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                    this.tempo = Song._clip(0, Config.tempoSteps, this.tempo);
                }
                else if (command == 109) {
                    this.reverb = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.reverb = Song._clip(0, Config.reverbRange, this.reverb);
                }   
                else if (command == 120) {
                    this.blend = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.blend = Song._clip(0, Config.blendRange, this.blend);
                }  
                else if (command == 121) {
                    this.riff = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.riff = Song._clip(0, Config.riffRange, this.riff);
                }    
                else if (command == 124) {
					this.sampleRate = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                }    
                else if (command == 68) {
                    if (beforeSeven) {
					}
                }    					
                else if (command == 72) {
                    this.detune = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.detune = Song._clip(0, Config.detuneRange, this.detune);
                }    	
                else if (command == 36) {
                    this.muff = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    this.muff = Song._clip(0, Config.muffRange, this.muff);
                }    					
                else if (command == 97) {
                    if (beforeThree) {
                        this.beatsPerBar = [6, 7, 8, 9, 10][base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
                    }
                    else {
                        this.beatsPerBar = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                    }
                    this.beatsPerBar = Math.max(Config.beatsPerBarMin, Math.min(Config.beatsPerBarMax, this.beatsPerBar));
                }
                else if (command == 103) {
                    this.barCount = (base64CharCodeToInt[compressed.charCodeAt(charIndex++)] << 6) + base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                    this.barCount = Math.max(Config.barCountMin, Math.min(Config.barCountMax, this.barCount));
                    for (var channel_1 = 0; channel_1 < this.getChannelCount(); channel_1++) {
                        for (var bar = this.channels[channel_1].bars.length; bar < this.barCount; bar++) {
                            this.channels[channel_1].bars[bar] = 1;
                        }
                        this.channels[channel_1].bars.length = this.barCount;
                    }
                }
                else if (command == 106) {
                    this.patternsPerChannel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                    this.patternsPerChannel = Math.max(Config.patternsPerChannelMin, Math.min(Config.patternsPerChannelMax, this.patternsPerChannel));
                    for (var channel_2 = 0; channel_2 < this.getChannelCount(); channel_2++) {
                        for (var pattern = this.channels[channel_2].patterns.length; pattern < this.patternsPerChannel; pattern++) {
                            this.channels[channel_2].patterns[pattern] = new Pattern();
                        }
                        this.channels[channel_2].patterns.length = this.patternsPerChannel;
                    }
                }
                else if (command == 105) {
                    this.instrumentsPerChannel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1;
                    this.instrumentsPerChannel = Math.max(Config.instrumentsPerChannelMin, Math.min(Config.instrumentsPerChannelMax, this.instrumentsPerChannel));
                    for (var channel_3 = 0; channel_3 < this.getChannelCount(); channel_3++) {
                        for (var instrument = this.channels[channel_3].instruments.length; instrument < this.instrumentsPerChannel; instrument++) {
                            this.channels[channel_3].instruments[instrument] = new Instrument();
                        }
                        this.channels[channel_3].instruments.length = this.instrumentsPerChannel;
                    }
                }
                else if (command == 114) {
                    this.partsPerBeat = Config.partCounts[base64CharCodeToInt[compressed.charCodeAt(charIndex++)]];
                }
                else if (command == 111) {
                    if (beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].octave = Song._clip(0, 5, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            this.channels[channel].octave = Song._clip(0, 5, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        }
                    }
                }
                else if (command == 84) {
                    instrumentIndexIterator++;
                    if (instrumentIndexIterator >= this.instrumentsPerChannel) {
                        instrumentChannelIterator++;
                        instrumentIndexIterator = 0;
                    }
                    var instrument = this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator];
                    instrument.setTypeAndReset(Song._clip(0, 3, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]));
                }
                else if (command == 119) {
                    if (beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].wave = Song._clip(0, Config.waveNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else if (beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            var isDrums = (channel >= this.pitchChannelCount);
                            for (var i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].wave = Song._clip(0, isDrums ? Config.drumNames.length : Config.waveNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        var isDrums = (instrumentChannelIterator >= this.pitchChannelCount);
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].wave = Song._clip(0, isDrums ? Config.drumNames.length : Config.waveNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 102) {
                    if (beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].filter = [1, 3, 4, 5][Song._clip(0, Config.filterNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)])];
                    }
                    else if (beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (var i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].filter = Song._clip(0, Config.filterNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)] + 1);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].filter = Song._clip(0, Config.filterNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 100) {
                    if (beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].transition = Song._clip(0, Config.transitionNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else if (beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (var i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].transition = Song._clip(0, Config.transitionNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].transition = Song._clip(0, Config.transitionNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 99) {
                    if (beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        var effect = Song._clip(0, Config.effectNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                        if (effect == 1)
                            effect = 3;
                        else if (effect == 3)
                            effect = 5;
                        this.channels[channel].instruments[0].effect = effect;
                    }
                    else if (beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (var i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].effect = Song._clip(0, Config.effectNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].effect = Song._clip(0, Config.effectNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 104) {
                    if (beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].chorus = Song._clip(0, Config.chorusNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else if (beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (var i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].chorus = Song._clip(0, Config.chorusNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].chorus = Song._clip(0, Config.chorusNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
				else if (command == 113) {
                    if (beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].harm = Song._clip(0, Config.harmNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else if (beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (var i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].harm = Song._clip(0, Config.harmNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].harm = Song._clip(0, Config.harmNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
				else if (command == 35) {
                    if (beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].fmChorus = Song._clip(0, Config.fmChorusNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else if (beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (var i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].harm = Song._clip(0, Config.fmChorusNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].fmChorus = Song._clip(0, Config.fmChorusNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
				else if (command == 71) {
                    if (beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].imute = Song._clip(0, Config.imuteNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else if (beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (var i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].imute = Song._clip(0, Config.imuteNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].imute = Song._clip(0, Config.imuteNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
				else if (command == 76) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].ipan = Song._clip(0, Config.ipanValues.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }   
				else if (command == 66) {
                    if (beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].octoff = Song._clip(0, Config.octoffNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else if (beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (var i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].octoff = Song._clip(0, Config.octoffNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].octoff = Song._clip(0, Config.octoffNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 118) {
                    if (beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        this.channels[channel].instruments[0].volume = Song._clip(0, Config.volumeNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                    else if (beforeSix) {
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (var i = 0; i < this.instrumentsPerChannel; i++) {
                                this.channels[channel].instruments[i].volume = Song._clip(0, Config.volumeNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                            }
                        }
                    }
                    else {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].volume = Song._clip(0, Config.volumeNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 65) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].algorithm = Song._clip(0, Config.operatorAlgorithmNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 70) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackType = Song._clip(0, Config.operatorFeedbackNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 95) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackAmplitude = Song._clip(0, Config.operatorAmplitudeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 86) {
                    this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].feedbackEnvelope = Song._clip(0, Config.operatorEnvelopeNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                }
                else if (command == 81) {
                    for (var o = 0; o < Config.operatorCount; o++) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].operators[o].frequency = Song._clip(0, Config.operatorFrequencyNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 80) {
                    for (var o = 0; o < Config.operatorCount; o++) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].operators[o].amplitude = Song._clip(0, Config.operatorAmplitudeMax + 1, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 69) {
                    for (var o = 0; o < Config.operatorCount; o++) {
                        this.channels[instrumentChannelIterator].instruments[instrumentIndexIterator].operators[o].envelope = Song._clip(0, Config.operatorEnvelopeNames.length, base64CharCodeToInt[compressed.charCodeAt(charIndex++)]);
                    }
                }
                else if (command == 98) {
                    var subStringLength = void 0;
                    if (beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        var barCount = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        subStringLength = Math.ceil(barCount * 0.5);
                        var bits = new BitFieldReader(base64CharCodeToInt, compressed, charIndex, charIndex + subStringLength);
                        for (var i = 0; i < barCount; i++) {
                            this.channels[channel].bars[i] = bits.read(3) + 1;
                        }
                    }
                    else if (beforeFive) {
                        var neededBits = 0;
                        while ((1 << neededBits) < this.patternsPerChannel)
                            neededBits++;
                        subStringLength = Math.ceil(this.getChannelCount() * this.barCount * neededBits / 6);
                        var bits = new BitFieldReader(base64CharCodeToInt, compressed, charIndex, charIndex + subStringLength);
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (var i = 0; i < this.barCount; i++) {
                                this.channels[channel].bars[i] = bits.read(neededBits) + 1;
                            }
                        }
                    }
                    else {
                        var neededBits = 0;
                        while ((1 << neededBits) < this.patternsPerChannel + 1)
                            neededBits++;
                        subStringLength = Math.ceil(this.getChannelCount() * this.barCount * neededBits / 6);
                        var bits = new BitFieldReader(base64CharCodeToInt, compressed, charIndex, charIndex + subStringLength);
                        for (channel = 0; channel < this.getChannelCount(); channel++) {
                            for (var i = 0; i < this.barCount; i++) {
                                this.channels[channel].bars[i] = bits.read(neededBits);
                            }
                        }
                    }
                    charIndex += subStringLength;
                }
                else if (command == 112) {
                    var bitStringLength = 0;
                    if (beforeThree) {
                        channel = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        charIndex++;
                        bitStringLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        bitStringLength = bitStringLength << 6;
                        bitStringLength += base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                    }
                    else {
                        channel = 0;
                        var bitStringLengthLength = base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                        while (bitStringLengthLength > 0) {
                            bitStringLength = bitStringLength << 6;
                            bitStringLength += base64CharCodeToInt[compressed.charCodeAt(charIndex++)];
                            bitStringLengthLength--;
                        }
                    }
                    var bits = new BitFieldReader(base64CharCodeToInt, compressed, charIndex, charIndex + bitStringLength);
                    charIndex += bitStringLength;
                    var neededInstrumentBits = 0;
                    while ((1 << neededInstrumentBits) < this.instrumentsPerChannel)
                        neededInstrumentBits++;
                    while (true) {
                        var isDrum = this.getChannelIsDrum(channel);
                        var octaveOffset = isDrum ? 0 : this.channels[channel].octave * 12;
                        var note = null;
                        var pin = null;
                        var lastPitch = (isDrum ? 4 : 12) + octaveOffset;
                        var recentPitches = isDrum ? [4, 6, 7, 2, 3, 8, 0, 10] : [12, 19, 24, 31, 36, 7, 0];
                        var recentShapes = [];
                        for (var i = 0; i < recentPitches.length; i++) {
                            recentPitches[i] += octaveOffset;
                        }
                        for (var i = 0; i < this.patternsPerChannel; i++) {
                            var newPattern = this.channels[channel].patterns[i];
                            newPattern.reset();
                            newPattern.instrument = bits.read(neededInstrumentBits);
                            if (!beforeThree && bits.read(1) == 0)
                                continue;
                            var curPart = 0;
                            var newNotes = newPattern.notes;
                            while (curPart < this.beatsPerBar * this.partsPerBeat) {
                                var useOldShape = bits.read(1) == 1;
                                var newNote = false;
                                var shapeIndex = 0;
                                if (useOldShape) {
                                    shapeIndex = bits.readLongTail(0, 0);
                                }
                                else {
                                    newNote = bits.read(1) == 1;
                                }
                                if (!useOldShape && !newNote) {
                                    var restLength = bits.readPartDuration();
                                    curPart += restLength;
                                }
                                else {
                                    var shape = void 0;
                                    var pinObj = void 0;
                                    var pitch = void 0;
                                    if (useOldShape) {
                                        shape = recentShapes[shapeIndex];
                                        recentShapes.splice(shapeIndex, 1);
                                    }
                                    else {
                                        shape = {};
                                        shape.pitchCount = 1;
                                        while (shape.pitchCount < 4 && bits.read(1) == 1)
                                            shape.pitchCount++;
                                        shape.pinCount = bits.readPinCount();
                                        shape.initialVolume = bits.read(2);
                                        shape.pins = [];
                                        shape.length = 0;
                                        shape.bendCount = 0;
                                        for (var j = 0; j < shape.pinCount; j++) {
                                            pinObj = {};
                                            pinObj.pitchBend = bits.read(1) == 1;
                                            if (pinObj.pitchBend)
                                                shape.bendCount++;
                                            shape.length += bits.readPartDuration();
                                            pinObj.time = shape.length;
                                            pinObj.volume = bits.read(2);
                                            shape.pins.push(pinObj);
                                        }
                                    }
                                    recentShapes.unshift(shape);
                                    if (recentShapes.length > 10)
                                        recentShapes.pop();
                                    note = makeNote(0, curPart, curPart + shape.length, shape.initialVolume);
                                    note.pitches = [];
                                    note.pins.length = 1;
                                    var pitchBends = [];
                                    for (var j = 0; j < shape.pitchCount + shape.bendCount; j++) {
                                        var useOldPitch = bits.read(1) == 1;
                                        if (!useOldPitch) {
                                            var interval = bits.readPitchInterval();
                                            pitch = lastPitch;
                                            var intervalIter = interval;
                                            while (intervalIter > 0) {
                                                pitch++;
                                                while (recentPitches.indexOf(pitch) != -1)
                                                    pitch++;
                                                intervalIter--;
                                            }
                                            while (intervalIter < 0) {
                                                pitch--;
                                                while (recentPitches.indexOf(pitch) != -1)
                                                    pitch--;
                                                intervalIter++;
                                            }
                                        }
                                        else {
                                            var pitchIndex = bits.read(3);
                                            pitch = recentPitches[pitchIndex];
                                            recentPitches.splice(pitchIndex, 1);
                                        }
                                        recentPitches.unshift(pitch);
                                        if (recentPitches.length > 8)
                                            recentPitches.pop();
                                        if (j < shape.pitchCount) {
                                            note.pitches.push(pitch);
                                        }
                                        else {
                                            pitchBends.push(pitch);
                                        }
                                        if (j == shape.pitchCount - 1) {
                                            lastPitch = note.pitches[0];
                                        }
                                        else {
                                            lastPitch = pitch;
                                        }
                                    }
                                    pitchBends.unshift(note.pitches[0]);
                                    for (var _b = 0, _c = shape.pins; _b < _c.length; _b++) {
                                        var pinObj_1 = _c[_b];
                                        if (pinObj_1.pitchBend)
                                            pitchBends.shift();
                                        pin = makeNotePin(pitchBends[0] - note.pitches[0], pinObj_1.time, pinObj_1.volume);
                                        note.pins.push(pin);
                                    }
                                    curPart = note.end;
                                    newNotes.push(note);
                                }
                            }
                        }
                        if (beforeThree) {
                            break;
                        }
                        else {
                            channel++;
                            if (channel >= this.getChannelCount())
                                break;
                        }
                    }
                }
            }
        };
        Song.prototype.toJsonObject = function (enableIntro, loopCount, enableOutro) {
            if (enableIntro === void 0) { enableIntro = true; }
            if (loopCount === void 0) { loopCount = 1; }
            if (enableOutro === void 0) { enableOutro = true; }
            var channelArray = [];
            for (var channel = 0; channel < this.getChannelCount(); channel++) {
                var instrumentArray = [];
                var isDrum = this.getChannelIsDrum(channel);
                for (var i = 0; i < this.instrumentsPerChannel; i++) {
                    var instrument = this.channels[channel].instruments[i];
                    if (isDrum) {
                        instrumentArray.push({
							type: Config.instrumentTypeNames[2],
                            volume: (5 - instrument.volume) * 20,
							imute: Config.muteNames[instrument.muteState],
                            mute: Config.muteNames[instrument.muteState],
                            wave: Config.drumNames[instrument.wave],
                            transition: Config.transitionNames[instrument.transition],
							octoff: Config.octaveOffsetNames[instrument.octaveOffset],
                            octaveOffset: Config.octaveOffsetNames[instrument.octaveOffset],
                        });
                    }
                    else {
                        if (instrument.type == 0) {
                            instrumentArray.push({
                                type: Config.instrumentTypeNames[instrument.type],
                                volume: (5 - instrument.volume) * 20,
                                wave: Config.waveNames[instrument.wave],
                                transition: Config.transitionNames[instrument.transition],
                                filter: Config.filterNames[instrument.filter],
                                chorus: Config.chorusNames[instrument.chorus],
                                effect: Config.effectNames[instrument.effect],
								harm: Config.harmNames[instrument.harm],
								imute: Config.muteNames[instrument.muteState],
                                mute: Config.muteNames[instrument.muteState],
								octoff: Config.octaveOffsetNames[instrument.octaveOffset],
                                octaveOffset: Config.octaveOffsetNames[instrument.octaveOffset],
                                pan: instrument.pan,
                                ipan: instrument.pan,
                            });
                        }
                        else if (instrument.type == 1) {
                            var operatorArray = [];
                            for (var _i = 0, _a = instrument.operators; _i < _a.length; _i++) {
                                var operator = _a[_i];
                                operatorArray.push({
                                    frequency: Config.operatorFrequencyNames[operator.frequency],
                                    amplitude: operator.amplitude,
                                    envelope: Config.operatorEnvelopeNames[operator.envelope],
                                });
                            }
                            instrumentArray.push({
                                type: Config.instrumentTypeNames[instrument.type],
								volume: (5 - instrument.volume) * 20,
                                transition: Config.transitionNames[instrument.transition],
                                effect: Config.effectNames[instrument.effect],
								octoff: Config.octaveOffsetNames[instrument.octaveOffset],
                                octaveOffset: Config.octaveOffsetNames[instrument.octaveOffset],
                                pan: instrument.pan,
                                ipan: instrument.pan,
								fmChorus: Config.fmChorusNames[instrument.fmChorus],
                                algorithm: Config.operatorAlgorithmNames[instrument.algorithm],
                                feedbackType: Config.operatorFeedbackNames[instrument.feedbackType],
                                feedbackAmplitude: instrument.feedbackAmplitude,
                                feedbackEnvelope: Config.operatorEnvelopeNames[instrument.feedbackEnvelope],
                                operators: operatorArray,
                            });
                        }
                        if (instrument.type == 3) {
                            instrumentArray.push({
                                type: Config.instrumentTypeNames[instrument.type],
                                volume: (5 - instrument.volume) * 20,
                                wave: Config.pwmWaveNames[instrument.wave],
                                transition: Config.transitionNames[instrument.transition],
                                filter: Config.filterNames[instrument.filter],
                                chorus: Config.chorusNames[instrument.chorus],
                                effect: Config.effectNames[instrument.effect],
								harm: Config.harmNames[instrument.harm],
								imute: Config.muteNames[instrument.muteState],
                                mute: Config.muteNames[instrument.muteState],
								octoff: Config.octaveOffsetNames[instrument.octaveOffset],
                                octaveOffset: Config.octaveOffsetNames[instrument.octaveOffset],
                                pan: instrument.pan,
                                ipan: instrument.pan,
                            });
                        }
                        else {
                            throw new Error("Unrecognized instrument type");
                        }
                    }
                }
                var patternArray = [];
                for (var _b = 0, _c = this.channels[channel].patterns; _b < _c.length; _b++) {
                    var pattern = _c[_b];
                    var noteArray = [];
                    for (var _d = 0, _e = pattern.notes; _d < _e.length; _d++) {
                        var note = _e[_d];
                        var pointArray = [];
                        for (var _f = 0, _g = note.pins; _f < _g.length; _f++) {
                            var pin = _g[_f];
                            pointArray.push({
                                tick: pin.time + note.start,
                                pitchBend: pin.interval,
                                volume: Math.round(pin.volume * 100 / 3),
                            });
                        }
                        noteArray.push({
                            pitches: note.pitches,
                            points: pointArray,
                        });
                    }
                    patternArray.push({
                        instrument: pattern.instrument + 1,
                        notes: noteArray,
                    });
                }
                var sequenceArray = [];
                if (enableIntro)
                    for (var i = 0; i < this.loopStart; i++) {
                        sequenceArray.push(this.channels[channel].bars[i]);
                    }
                for (var l = 0; l < loopCount; l++)
                    for (var i = this.loopStart; i < this.loopStart + this.loopLength; i++) {
                        sequenceArray.push(this.channels[channel].bars[i]);
                    }
                if (enableOutro)
                    for (var i = this.loopStart + this.loopLength; i < this.barCount; i++) {
                        sequenceArray.push(this.channels[channel].bars[i]);
                    }
                channelArray.push({
                    type: isDrum ? "drum" : "pitch",
                    octaveScrollBar: this.channels[channel].octave,
                    instruments: instrumentArray,
                    patterns: patternArray,
                    sequence: sequenceArray,
                });
            }
            return {
                format: Song._format,
                version: Song._latestVersion,
				theme: Config.themeNames[this.theme],
                scale: Config.scaleNames[this.scale],
				mix: Config.mixNames[this.mix],
				sampleRate: Config.sampleRateNames[this.sampleRate],
                key: Config.keyNames[this.key],
                introBars: this.loopStart,
                loopBars: this.loopLength,
                beatsPerBar: this.beatsPerBar,
                ticksPerBeat: this.partsPerBeat,
                beatsPerMinute: this.getBeatsPerMinute(),
                reverb: this.reverb,
                blend: this.blend,
                riff: this.riff,
				detune: this.detune,
				muff: this.muff,
                channels: channelArray,
            };
        };
        Song.prototype.fromJsonObject = function (jsonObject) {
            this.initToDefault(true);
            if (!jsonObject)
                return;
            var version = jsonObject.version;
            if (version > Song._format)
                return;
            this.scale = 11;
            if (jsonObject.scale != undefined) {
                var oldScaleNames = { "romani :)": 8, "romani :(": 9 };
                var scale = oldScaleNames[jsonObject.scale] != undefined ? oldScaleNames[jsonObject.scale] : Config.scaleNames.indexOf(jsonObject.scale);
                if (scale != -1)
                    this.scale = scale;
            }
            if (jsonObject.mix != undefined) {
                if (jsonObject.mix != -1)
                    this.mix = jsonObject.mix;
            }
            if (jsonObject.sampleRate != undefined) {
                if (jsonObject.sampleRate != -1)
                    this.sampleRate = jsonObject.sampleRate;
            }
            if (jsonObject.key != undefined) {
                if (typeof (jsonObject.key) == "number") {
                    this.key = Config.keyNames.length - 1 - (((jsonObject.key + 1200) >>> 0) % Config.keyNames.length);
                }
                else if (typeof (jsonObject.key) == "string") {
                    var key = jsonObject.key;
                    var letter = key.charAt(0).toUpperCase();
                    var symbol = key.charAt(1).toLowerCase();
                    var letterMap = { "C": 11, "D": 9, "E": 7, "F": 6, "G": 4, "A": 2, "B": 0 };
                    var accidentalMap = { "#": -1, "â™¯": -1, "b": 1, "â™­": 1 };
                    var index = letterMap[letter];
                    var offset = accidentalMap[symbol];
                    if (index != undefined) {
                        if (offset != undefined)
                            index += offset;
                        if (index < 0)
                            index += 12;
                        index = index % 12;
                        this.key = index;
                    }
                }
            }
            if (jsonObject.beatsPerMinute != undefined) {
                var bpm = jsonObject.beatsPerMinute | 0;
                this.tempo = Math.round(4.0 + 9.0 * Math.log(bpm / 120) / Math.LN2);
                this.tempo = Song._clip(0, Config.tempoSteps, this.tempo);
            }
            if (jsonObject.reverb != undefined) {
                this.reverb = Song._clip(0, Config.reverbRange, jsonObject.reverb | 0);
            }
            if (jsonObject.blend != undefined) {
                this.blend = Song._clip(0, Config.blendRange, jsonObject.blend | 0);
            }
            if (jsonObject.riff != undefined) {
                this.riff = Song._clip(0, Config.riffRange, jsonObject.riff | 0);
            }
            if (jsonObject.detune != undefined) {
                this.detune = Song._clip(0, Config.detuneRange, jsonObject.detune | 0);
            }
            if (jsonObject.muff != undefined) {
                this.muff = Song._clip(0, Config.muffRange, jsonObject.muff | 0);
            }
            if (jsonObject.beatsPerBar != undefined) {
                this.beatsPerBar = Math.max(Config.beatsPerBarMin, Math.min(Config.beatsPerBarMax, jsonObject.beatsPerBar | 0));
            }
            if (jsonObject.ticksPerBeat != undefined) {
                this.partsPerBeat = jsonObject.ticksPerBeat | 0;
                if (Config.partCounts.indexOf(this.partsPerBeat) == -1) {
                    this.partsPerBeat = Config.partCounts[Config.partCounts.length - 1];
                }
            }
            var maxInstruments = 1;
            var maxPatterns = 1;
            var maxBars = 1;
            if (jsonObject.channels) {
                for (var _i = 0, _a = jsonObject.channels; _i < _a.length; _i++) {
                    var channelObject = _a[_i];
                    if (channelObject.instruments)
                        maxInstruments = Math.max(maxInstruments, channelObject.instruments.length | 0);
                    if (channelObject.patterns)
                        maxPatterns = Math.max(maxPatterns, channelObject.patterns.length | 0);
                    if (channelObject.sequence)
                        maxBars = Math.max(maxBars, channelObject.sequence.length | 0);
                }
            }
            this.instrumentsPerChannel = maxInstruments;
            this.patternsPerChannel = maxPatterns;
            this.barCount = maxBars;
            if (jsonObject.introBars != undefined) {
                this.loopStart = Song._clip(0, this.barCount, jsonObject.introBars | 0);
            }
            if (jsonObject.loopBars != undefined) {
                this.loopLength = Song._clip(1, this.barCount - this.loopStart + 1, jsonObject.loopBars | 0);
            }
            var pitchChannelCount = 0;
            var drumChannelCount = 0;
            if (jsonObject.channels) {
                for (var channel = 0; channel < jsonObject.channels.length; channel++) {
                    var channelObject = jsonObject.channels[channel];
                    if (this.channels.length <= channel)
                        this.channels[channel] = new Channel();
                    if (channelObject.octaveScrollBar != undefined) {
                        this.channels[channel].octave = Song._clip(0, 5, channelObject.octaveScrollBar | 0);
                    }
                    for (var i = this.channels[channel].instruments.length; i < this.instrumentsPerChannel; i++) {
                        this.channels[channel].instruments[i] = new Instrument();
                    }
                    this.channels[channel].instruments.length = this.instrumentsPerChannel;
                    for (var i = this.channels[channel].patterns.length; i < this.patternsPerChannel; i++) {
                        this.channels[channel].patterns[i] = new Pattern();
                    }
                    this.channels[channel].patterns.length = this.patternsPerChannel;
                    for (var i = 0; i < this.barCount; i++) {
                        this.channels[channel].bars[i] = 1;
                    }
                    this.channels[channel].bars.length = this.barCount;
                    var isDrum = false;
                    if (channelObject.type) {
                        isDrum = (channelObject.type == "drum");
                    }
                    else {
                        isDrum = (channel >= 3);
                    }
                    if (isDrum)
                        drumChannelCount++;
                    else
                        pitchChannelCount++;
                    for (var i = 0; i < this.instrumentsPerChannel; i++) {
                        var instrument = this.channels[channel].instruments[i];
                        var instrumentObject = undefined;
                        if (channelObject.instruments)
                            instrumentObject = channelObject.instruments[i];
                        if (instrumentObject == undefined)
                            instrumentObject = {};
                        var oldTransitionNames = { "binary": 0 };
                        var transitionObject = instrumentObject.transition || instrumentObject.envelope;
                        instrument.transition = oldTransitionNames[transitionObject] != undefined ? oldTransitionNames[transitionObject] : Config.transitionNames.indexOf(transitionObject);
                        if (instrument.transition == -1)
                            instrument.transition = 1;
                        if (isDrum) {
                            if (instrumentObject.volume != undefined) {
                                instrument.volume = Song._clip(0, Config.volumeNames.length, Math.round(5 - (instrumentObject.volume | 0) / 20));
                            }
                            else {
                                instrument.volume = 0;
                            }
                            instrument.wave = Config.drumNames.indexOf(instrumentObject.wave);
                            if (instrument.wave == -1)
                                instrument.wave = 1;
                            var muteName = instrumentObject.mute != undefined ? instrumentObject.mute : instrumentObject.imute;
                            instrument.muteState = Config.muteNames.indexOf(muteName);
                            if (instrument.muteState == -1)
                                instrument.muteState = 0;
							if (instrumentObject.pan != undefined || instrumentObject.ipan != undefined) {
								instrument.pan = Song._clip(0, Config.panValues.length, ((instrumentObject.pan != undefined ? instrumentObject.pan : instrumentObject.ipan) | 0));
								}
                        }
                        else {
                            instrument.type = Config.instrumentTypeNames.indexOf(instrumentObject.type);
                            if (instrument.type == -1)
                                instrument.type = 0;
                            if (instrument.type == 0) {
                                if (instrumentObject.volume != undefined) {
                                    instrument.volume = Song._clip(0, Config.volumeNames.length, Math.round(5 - (instrumentObject.volume | 0) / 20));
                                }
                                else {
                                    instrument.volume = 0;
                                }
                                instrument.wave = Config.waveNames.indexOf(instrumentObject.wave);
                                if (instrument.wave == -1)
                                    instrument.wave = 1;
                                var oldFilterNames = { "sustain sharp": 1, "sustain medium": 2, "sustain soft": 3, "decay sharp": 4 };
                                instrument.filter = oldFilterNames[instrumentObject.filter] != undefined ? oldFilterNames[instrumentObject.filter] : Config.filterNames.indexOf(instrumentObject.filter);
                                if (instrument.filter == -1)
                                    instrument.filter = 0;
                                instrument.chorus = Config.chorusNames.indexOf(instrumentObject.chorus);
                                if (instrument.chorus == -1)
                                    instrument.chorus = 0;
                                instrument.effect = Config.effectNames.indexOf(instrumentObject.effect);
                                if (instrument.effect == -1)
                                    instrument.effect = 0;
								instrument.harm = Config.harmNames.indexOf(instrumentObject.harm);
                                if (instrument.harm == -1)
                                    instrument.harm = 0;
								var octaveOffsetName = instrumentObject.octaveOffset != undefined ? instrumentObject.octaveOffset : instrumentObject.octoff;
                                instrument.octaveOffset = Config.octaveOffsetNames.indexOf(octaveOffsetName);
                                if (instrument.octaveOffset == -1)
                                    instrument.octaveOffset = 0;
								var muteName = instrumentObject.mute != undefined ? instrumentObject.mute : instrumentObject.imute;
                                instrument.muteState = Config.muteNames.indexOf(muteName);
                                if (instrument.muteState == -1)
                                    instrument.muteState = 0;
								if (instrumentObject.pan != undefined || instrumentObject.ipan != undefined) {
								instrument.pan = Song._clip(0, Config.panValues.length, ((instrumentObject.pan != undefined ? instrumentObject.pan : instrumentObject.ipan) | 0));
								}
                            }
                            else if (instrument.type == 1) {
                                instrument.effect = Config.effectNames.indexOf(instrumentObject.effect);
                                if (instrument.effect == -1)
                                    instrument.effect = 0;
								var octaveOffsetName = instrumentObject.octaveOffset != undefined ? instrumentObject.octaveOffset : instrumentObject.octoff;
                                instrument.octaveOffset = Config.octaveOffsetNames.indexOf(octaveOffsetName);
                                if (instrument.octaveOffset == -1)
                                    instrument.octaveOffset = 0;
								instrument.fmChorus = Config.fmChorusNames.indexOf(instrumentObject.fmChorus);
                                if (instrument.fmChorus == -1)
                                    instrument.fmChorus = 0;
                                instrument.algorithm = Config.operatorAlgorithmNames.indexOf(instrumentObject.algorithm);
                                if (instrument.algorithm == -1)
                                    instrument.algorithm = 0;
                                instrument.feedbackType = Config.operatorFeedbackNames.indexOf(instrumentObject.feedbackType);
                                if (instrument.feedbackType == -1)
                                    instrument.feedbackType = 0;
                                if (instrumentObject.feedbackAmplitude != undefined) {
                                    instrument.feedbackAmplitude = Song._clip(0, Config.operatorAmplitudeMax + 1, instrumentObject.feedbackAmplitude | 0);
                                }
                                else {
                                    instrument.feedbackAmplitude = 0;
                                }
                                instrument.feedbackEnvelope = Config.operatorEnvelopeNames.indexOf(instrumentObject.feedbackEnvelope);
                                if (instrument.feedbackEnvelope == -1)
                                    instrument.feedbackEnvelope = 0;
                                for (var j = 0; j < Config.operatorCount; j++) {
                                    var operator = instrument.operators[j];
                                    var operatorObject = undefined;
                                    if (instrumentObject.operators)
                                        operatorObject = instrumentObject.operators[j];
                                    if (operatorObject == undefined)
                                        operatorObject = {};
                                    operator.frequency = Config.operatorFrequencyNames.indexOf(operatorObject.frequency);
                                    if (operator.frequency == -1)
                                        operator.frequency = 0;
                                    if (operatorObject.amplitude != undefined) {
                                        operator.amplitude = Song._clip(0, Config.operatorAmplitudeMax + 1, operatorObject.amplitude | 0);
                                    }
                                    else {
                                        operator.amplitude = 0;
                                    }
                                    operator.envelope = Config.operatorEnvelopeNames.indexOf(operatorObject.envelope);
                                    if (operator.envelope == -1)
                                        operator.envelope = 0;
                                }
								if (instrumentObject.pan != undefined || instrumentObject.ipan != undefined) {
								instrument.pan = Song._clip(0, Config.panValues.length, ((instrumentObject.pan != undefined ? instrumentObject.pan : instrumentObject.ipan) | 0));
								}
                            }
                            else if (instrument.type == 3) {
                                if (instrumentObject.volume != undefined) {
                                    instrument.volume = Song._clip(0, Config.volumeNames.length, Math.round(5 - (instrumentObject.volume | 0) / 20));
                                }
                                else {
                                    instrument.volume = 0;
                                }
                                instrument.wave = Config.pwmWaveNames.indexOf(instrumentObject.wave);
                                if (instrument.wave == -1)
                                    instrument.wave = 1;
                                var oldFilterNames = { "sustain sharp": 1, "sustain medium": 2, "sustain soft": 3, "decay sharp": 4 };
                                instrument.filter = oldFilterNames[instrumentObject.filter] != undefined ? oldFilterNames[instrumentObject.filter] : Config.filterNames.indexOf(instrumentObject.filter);
                                if (instrument.filter == -1)
                                    instrument.filter = 0;
                                instrument.chorus = Config.chorusNames.indexOf(instrumentObject.chorus);
                                if (instrument.chorus == -1)
                                    instrument.chorus = 0;
                                instrument.effect = Config.effectNames.indexOf(instrumentObject.effect);
                                if (instrument.effect == -1)
                                    instrument.effect = 0;
								instrument.harm = Config.harmNames.indexOf(instrumentObject.harm);
                                if (instrument.harm == -1)
                                    instrument.harm = 0;
								var octaveOffsetName = instrumentObject.octaveOffset != undefined ? instrumentObject.octaveOffset : instrumentObject.octoff;
                                instrument.octaveOffset = Config.octaveOffsetNames.indexOf(octaveOffsetName);
                                if (instrument.octaveOffset == -1)
                                    instrument.octaveOffset = 0;
								var muteName = instrumentObject.mute != undefined ? instrumentObject.mute : instrumentObject.imute;
                                instrument.muteState = Config.muteNames.indexOf(muteName);
                                if (instrument.muteState == -1)
                                    instrument.muteState = 0;
								if (instrumentObject.pan != undefined || instrumentObject.ipan != undefined) {
								instrument.pan = Song._clip(0, Config.panValues.length, ((instrumentObject.pan != undefined ? instrumentObject.pan : instrumentObject.ipan) | 0));
								}
                            }
                            else {
                                throw new Error("Unrecognized instrument type.");
                            }
                        }
                    }
                    for (var i = 0; i < this.patternsPerChannel; i++) {
                        var pattern = this.channels[channel].patterns[i];
                        var patternObject = undefined;
                        if (channelObject.patterns)
                            patternObject = channelObject.patterns[i];
                        if (patternObject == undefined)
                            continue;
                        pattern.instrument = Song._clip(0, this.instrumentsPerChannel, (patternObject.instrument | 0) - 1);
                        if (patternObject.notes && patternObject.notes.length > 0) {
                            var maxNoteCount = Math.min(this.beatsPerBar * this.partsPerBeat, patternObject.notes.length >>> 0);
                            var tickClock = 0;
                            for (var j = 0; j < patternObject.notes.length; j++) {
                                if (j >= maxNoteCount)
                                    break;
                                var noteObject = patternObject.notes[j];
                                if (!noteObject || !noteObject.pitches || !(noteObject.pitches.length >= 1) || !noteObject.points || !(noteObject.points.length >= 2)) {
                                    continue;
                                }
                                var note = makeNote(0, 0, 0, 0);
                                note.pitches = [];
                                note.pins = [];
                                for (var k = 0; k < noteObject.pitches.length; k++) {
                                    var pitch = noteObject.pitches[k] | 0;
                                    if (note.pitches.indexOf(pitch) != -1)
                                        continue;
                                    note.pitches.push(pitch);
                                    if (note.pitches.length >= 4)
                                        break;
                                }
                                if (note.pitches.length < 1)
                                    continue;
                                var noteClock = tickClock;
                                var startInterval = 0;
                                for (var k = 0; k < noteObject.points.length; k++) {
                                    var pointObject = noteObject.points[k];
                                    if (pointObject == undefined || pointObject.tick == undefined)
                                        continue;
                                    var interval = (pointObject.pitchBend == undefined) ? 0 : (pointObject.pitchBend | 0);
                                    var time = pointObject.tick | 0;
                                    var volume = (pointObject.volume == undefined) ? 3 : Math.max(0, Math.min(3, Math.round((pointObject.volume | 0) * 3 / 100)));
                                    if (time > this.beatsPerBar * this.partsPerBeat)
                                        continue;
                                    if (note.pins.length == 0) {
                                        if (time < noteClock)
                                            continue;
                                        note.start = time;
                                        startInterval = interval;
                                    }
                                    else {
                                        if (time <= noteClock)
                                            continue;
                                    }
                                    noteClock = time;
                                    note.pins.push(makeNotePin(interval - startInterval, time - note.start, volume));
                                }
                                if (note.pins.length < 2)
                                    continue;
                                note.end = note.pins[note.pins.length - 1].time + note.start;
                                var maxPitch = isDrum ? Config.drumCount - 1 : Config.maxPitch;
                                var lowestPitch = maxPitch;
                                var highestPitch = 0;
                                for (var k = 0; k < note.pitches.length; k++) {
                                    note.pitches[k] += startInterval;
                                    if (note.pitches[k] < 0 || note.pitches[k] > maxPitch) {
                                        note.pitches.splice(k, 1);
                                        k--;
                                    }
                                    if (note.pitches[k] < lowestPitch)
                                        lowestPitch = note.pitches[k];
                                    if (note.pitches[k] > highestPitch)
                                        highestPitch = note.pitches[k];
                                }
                                if (note.pitches.length < 1)
                                    continue;
                                for (var k = 0; k < note.pins.length; k++) {
                                    var pin = note.pins[k];
                                    if (pin.interval + lowestPitch < 0)
                                        pin.interval = -lowestPitch;
                                    if (pin.interval + highestPitch > maxPitch)
                                        pin.interval = maxPitch - highestPitch;
                                    if (k >= 2) {
                                        if (pin.interval == note.pins[k - 1].interval &&
                                            pin.interval == note.pins[k - 2].interval &&
                                            pin.volume == note.pins[k - 1].volume &&
                                            pin.volume == note.pins[k - 2].volume) {
                                            note.pins.splice(k - 1, 1);
                                            k--;
                                        }
                                    }
                                }
                                pattern.notes.push(note);
                                tickClock = note.end;
                            }
                        }
                    }
                    for (var i = 0; i < this.barCount; i++) {
                        this.channels[channel].bars[i] = channelObject.sequence ? Math.min(this.patternsPerChannel, channelObject.sequence[i] >>> 0) : 0;
                    }
                }
            }
            this.pitchChannelCount = pitchChannelCount;
            this.drumChannelCount = drumChannelCount;
            this.channels.length = this.getChannelCount();
        };
        Song._clip = function (min, max, val) {
            max = max - 1;
            if (val <= max) {
                if (val >= min)
                    return val;
                else
                    return min;
            }
            else {
                return max;
            }
        };
        Song.prototype.getPattern = function (channel, bar) {
            var patternIndex = this.channels[channel].bars[bar];
            if (patternIndex == 0)
                return null;
            return this.channels[channel].patterns[patternIndex - 1];
        };
        Song.prototype.getPatternInstrument = function (channel, bar) {
            var pattern = this.getPattern(channel, bar);
            return pattern == null ? 0 : pattern.instrument;
        };
		Song.prototype.getPatternInstrumentMute = function (channel, bar) {
            var pattern = this.getPattern(channel, bar);
            var instrumentIndex = this.getPatternInstrument(channel, bar);
			var instrument = this.channels[channel].instruments[instrumentIndex];
			return pattern == null ? 0 : instrument.muteState;
			return instrument;
			return instrumentIndex;
        };
		Song.prototype.getPatternInstrumentVolume = function (channel, bar) {
            var pattern = this.getPattern(channel, bar);
            var instrumentIndex = this.getPatternInstrument(channel, bar);
			var instrument = this.channels[channel].instruments[instrumentIndex];
			return pattern == null ? 0 : instrument.volume;
			return instrument;
			return instrumentIndex;
        };
        Song.prototype.getBeatsPerMinute = function () {
            return Math.round(120.0 * Math.pow(2.0, (-4.0 + this.tempo) / 9.0));
        };
        Song.prototype.getChannelFingerprint = function (bar) {
            var channelCount = this.getChannelCount();
            var charCount = 0;
            for (var channel = 0; channel < channelCount; channel++) {
                if (channel < this.pitchChannelCount) {
                    var instrumentIndex = this.getPatternInstrument(channel, bar);
                    var instrument = this.channels[channel].instruments[instrumentIndex];
                    if (instrument.type == 0) {
                        this._fingerprint[charCount++] = "c";
                    }
                    else if (instrument.type == 1) {
                        this._fingerprint[charCount++] = "f";
                        this._fingerprint[charCount++] = instrument.algorithm;
                        this._fingerprint[charCount++] = instrument.feedbackType;
                    }
                    else if (instrument.type == 2) {
                        this._fingerprint[charCount++] = "c";
                    }
                    else {
                        throw new Error("Unknown instrument type.");
                    }
                }
                else {
                    this._fingerprint[charCount++] = "d";
                }
            }
            this._fingerprint.length = charCount;
            return this._fingerprint.join("");
        };
        return Song;
    }());
    Song._format = "BeepBox";
    Song._oldestVersion = 2;
    Song._latestVersion = 6;
    Song._base64CharCodeToInt = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 62, 62, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 0, 0, 0, 0, 0, 0, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 0, 0, 0, 0, 63, 0, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 0, 0, 0, 0, 0];
    Song._base64IntToCharCode = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 45, 95];
    beepbox.Song = Song;
    var SynthChannel = (function () {
        function SynthChannel() {
            this.sampleLeft = 0.0;
			this.sampleRight = 0.0;
            this.phases = [];
            this.phaseDeltas = [];
            this.volumeStarts = [];
            this.volumeDeltas = [];
			this.volumeLeft = [];
			this.volumeRight = [];
            this.phaseDeltaScale = 0.0;
            this.filter = 0.0;
            this.filterScale = 0.0;
            this.vibratoScale = 0.0;
            this.harmonyMult = 0.0;
            this.harmonyVolumeMult = 1.0;
            this.feedbackOutputs = [];
            this.feedbackMult = 0.0;
            this.feedbackDelta = 0.0;
            this.reset();
        }
        SynthChannel.prototype.reset = function () {
            for (var i = 0; i < Config.operatorCount; i++) {
                this.phases[i] = 0.0;
                this.feedbackOutputs[i] = 0.0;
            }
            this.sampleLeft = 0.0;
			this.sampleRight = 0.0;
        };
        return SynthChannel;
    }());
    var Synth = (function () {
        function Synth(song) {
            if (song === void 0) { song = null; }
            var _this = this;
            this.samplesPerSecond = 44100;
            this.effectDuration = 0.14;
            this.effectAngle = Math.PI * 2.0 / (this.effectDuration * this.samplesPerSecond);
            this.effectYMult = 2.0 * Math.cos(this.effectAngle);
            this.limitDecay = 1.0 / (2.0 * this.samplesPerSecond);
            this.song = null;
            this.pianoPressed = false;
            this.pianoPitch = [0];
            this.pianoChannel = 0;
            this.enableIntro = true;
            this.enableOutro = false;
            this.loopCount = -1;
            this.volume = 1.0;
            this.playheadInternal = 0.0;
            this.bar = 0;
            this.beat = 0;
            this.part = 0;
            this.arpeggio = 0;
            this.arpeggioSampleCountdown = 0;
            this.paused = true;
            this.channels = [];
            this.stillGoing = false;
            this.effectPhase = 0.0;
            this.limit = 0.0;
            this.delayLineLeft = new Float32Array(16384);
			this.delayLineRight = new Float32Array(16384);
            this.delayPosLeft = 0;
            this.delayFeedback0Left = 0.0;
            this.delayFeedback1Left = 0.0;
            this.delayFeedback2Left = 0.0;
            this.delayFeedback3Left = 0.0;
			this.delayPosRight = 0;
            this.delayFeedback0Right = 0.0;
            this.delayFeedback1Right = 0.0;
            this.delayFeedback2Right = 0.0;
            this.delayFeedback3Right = 0.0;
            this._resampBufLeft = null;
            this._resampBufRight = null;
            this._resampPhase = 0;
            this.audioProcessCallback = function (audioProcessingEvent) {
                var outputBuffer = audioProcessingEvent.outputBuffer;
                var outLeft = outputBuffer.getChannelData(0);
                var outRight = outputBuffer.getChannelData(1);
                var outLen = outputBuffer.length;
                var deviceRate = _this.audioCtx.sampleRate;
                var synthRate = _this.samplesPerSecond;
                if (synthRate === deviceRate) {
                    _this.synthesize(outLeft, outRight, outLen);
                    return;
                }
                var ratio = synthRate / deviceRate;
                var phase = _this._resampPhase;
                var synthLen = Math.ceil(phase + outLen * ratio) + 1;
                if (!_this._resampBufLeft || _this._resampBufLeft.length < synthLen) {
                    _this._resampBufLeft = new Float32Array(synthLen);
                    _this._resampBufRight = new Float32Array(synthLen);
                }
                _this.synthesize(_this._resampBufLeft, _this._resampBufRight, synthLen);
                for (var i = 0; i < outLen; i++) {
                    var srcPos = phase + i * ratio;
                    var srcIdx = srcPos | 0;
                    var frac = srcPos - srcIdx;
                    var nextIdx = srcIdx + 1 < synthLen ? srcIdx + 1 : srcIdx;
                    outLeft[i] = _this._resampBufLeft[srcIdx] + (_this._resampBufLeft[nextIdx] - _this._resampBufLeft[srcIdx]) * frac;
                    outRight[i] = _this._resampBufRight[srcIdx] + (_this._resampBufRight[nextIdx] - _this._resampBufRight[srcIdx]) * frac;
                }
                _this._resampPhase = (phase + outLen * ratio) % 1;
            };
            if (song != null)
                this.setSong(song);
        }
        Synth.warmUpSynthesizer = function (song) {
            if (song != null) {
                for (var i = 0; i < song.instrumentsPerChannel; i++) {
                    for (var j = song.pitchChannelCount; j < song.pitchChannelCount + song.drumChannelCount; j++) {
                        Config.getDrumWave(song.channels[j].instruments[i].wave);
                    }
                }
                for (var i = 0; i < song.barCount; i++) {
                    Synth.getGeneratedSynthesizer(song, i);
                }
            }
        };
        Synth.operatorAmplitudeCurve = function (amplitude) {
            return (Math.pow(16.0, amplitude / 15.0) - 1.0) / 15.0;
        };
        Object.defineProperty(Synth.prototype, "playing", {
            get: function () {
                return !this.paused;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Synth.prototype, "playhead", {
            get: function () {
                return this.playheadInternal;
            },
            set: function (value) {
                if (this.song != null) {
                    this.playheadInternal = Math.max(0, Math.min(this.song.barCount, value));
                    var remainder = this.playheadInternal;
                    this.bar = Math.floor(remainder);
                    remainder = this.song.beatsPerBar * (remainder - this.bar);
                    this.beat = Math.floor(remainder);
                    remainder = this.song.partsPerBeat * (remainder - this.beat);
                    this.part = Math.floor(remainder);
                    remainder = 4 * (remainder - this.part);
                    this.arpeggio = Math.floor(remainder);
                    var samplesPerArpeggio = this.getSamplesPerArpeggio();
                    remainder = samplesPerArpeggio * (remainder - this.arpeggio);
                    this.arpeggioSampleCountdown = Math.floor(samplesPerArpeggio - remainder);
                    if (this.bar < this.song.loopStart) {
                        this.enableIntro = true;
                    }
                    if (this.bar > this.song.loopStart + this.song.loopLength) {
                        this.enableOutro = true;
                    }
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Synth.prototype, "totalSamples", {
            get: function () {
                if (this.song == null)
                    return 0;
                var samplesPerBar = this.getSamplesPerArpeggio() * 4 * this.song.partsPerBeat * this.song.beatsPerBar;
                var loopMinCount = this.loopCount;
                if (loopMinCount < 0)
                    loopMinCount = 1;
                var bars = this.song.loopLength * loopMinCount;
                if (this.enableIntro)
                    bars += this.song.loopStart;
                if (this.enableOutro)
                    bars += this.song.barCount - (this.song.loopStart + this.song.loopLength);
                return bars * samplesPerBar;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Synth.prototype, "totalSeconds", {
            get: function () {
                return Math.round(this.totalSamples / this.samplesPerSecond);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Synth.prototype, "totalBars", {
            get: function () {
                if (this.song == null)
                    return 0.0;
                return this.song.barCount;
            },
            enumerable: true,
            configurable: true
        });
        Synth.prototype.setSong = function (song) {
            if (typeof (song) == "string") {
                this.song = new Song(song);
            }
            else if (song instanceof Song) {
                this.song = song;
            }
        };
		Synth.prototype.spsCalc = function () {
			Synth.warmUpSynthesizer(this.song);
			if (!Synth._deviceRate) {
				var contextClass = (window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.oAudioContext || window.msAudioContext);
				var tmp = new contextClass();
				Synth._deviceRate = tmp.sampleRate;
				if (tmp.close) tmp.close();
			}
			var ctxRate = Synth._deviceRate;
			if (this.song.sampleRate == 0) return 44100;
			else if (this.song.sampleRate == 1) return 48000;
			else if (this.song.sampleRate == 2) return ctxRate;
			else if (this.song.sampleRate == 3) return ctxRate*4;
			else if (this.song.sampleRate == 4) return ctxRate*2;
			else if (this.song.sampleRate == 5) return ctxRate/2;
			else if (this.song.sampleRate == 6) return ctxRate/4;
			else if (this.song.sampleRate == 7) return ctxRate/8;
			else if (this.song.sampleRate == 8) return ctxRate/16;
			else return ctxRate;
		}
		Synth._deviceRate = null;
		Synth._makeAudioCtx = function (synthRate) {
			var contextClass = (window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.oAudioContext || window.msAudioContext);
			if (synthRate >= 8000 && synthRate <= 96000) {
				try { return new contextClass({ sampleRate: synthRate }); } catch(e) {}
			}
			return new contextClass();
		};
		Synth._startAudioGraph = function (synth) {
			var synthRate = synth.spsCalc();
			synth.audioCtx = Synth._makeAudioCtx(synthRate);
			synth.scriptNode = synth.audioCtx.createScriptProcessor ? synth.audioCtx.createScriptProcessor(2048, 0, 2) : synth.audioCtx.createJavaScriptNode(2048, 0, 2);
			synth.scriptNode.onaudioprocess = synth.audioProcessCallback;
			synth.scriptNode.connect(synth.audioCtx.destination);
			synth.scriptNode.channelCountMode = 'explicit';
			synth.scriptNode.channelInterpretation = 'speakers';
			synth.samplesPerSecond = synthRate;
			synth.effectAngle = Math.PI * 2.0 / (synth.effectDuration * synthRate);
			synth.effectYMult = 2.0 * Math.cos(synth.effectAngle);
			synth.limitDecay = 1.0 / (2.0 * synthRate);
		};
        Synth.prototype.play = function () {
            if (!this.paused) return;
            this.paused = false;
            Synth.warmUpSynthesizer(this.song);
			Synth._startAudioGraph(this);
        };
		Synth.prototype.restartAudio = function () {
			if (this.paused) return;
			if (this.scriptNode) this.scriptNode.disconnect();
			if (this.audioCtx && this.audioCtx.close) this.audioCtx.close();
			this.audioCtx = null;
			this.scriptNode = null;
			this._resampPhase = 0;
			Synth._startAudioGraph(this);
		};
        Synth.prototype.pause = function () {
            if (this.paused)
                return;
            this.paused = true;
            if (this.audioCtx.close) {
                this.audioCtx.close();
                this.audioCtx = null;
            }
            this.scriptNode = null;
        };
        Synth.prototype.snapToStart = function () {
            this.bar = 0;
            this.enableIntro = true;
            this.snapToBar();
        };
        Synth.prototype.snapToBar = function (bar) {
            if (bar !== undefined)
                this.bar = bar;
            this.playheadInternal = this.bar;
            this.beat = 0;
            this.part = 0;
            this.arpeggio = 0;
            this.arpeggioSampleCountdown = 0;
            this.effectPhase = 0.0;
            for (var _i = 0, _a = this.channels; _i < _a.length; _i++) {
                var channel = _a[_i];
                channel.reset();
            }
            this.delayPosLeft = 0;
            this.delayFeedback0Left = 0.0;
            this.delayFeedback1Left = 0.0;
            this.delayFeedback2Left = 0.0;
            this.delayFeedback3Left = 0.0;
            for (var i = 0; i < this.delayLineLeft.length; i++)
                this.delayLineLeft[i] = 0.0;
			this.delayPosRight = 0;
            this.delayFeedback0Right = 0.0;
            this.delayFeedback1Right = 0.0;
            this.delayFeedback2Right = 0.0;
            this.delayFeedback3Right = 0.0;
            for (var i = 0; i < this.delayLineRight.length; i++)
                this.delayLineRight[i] = 0.0;
        };
        Synth.prototype.nextBar = function () {
            if (!this.song)
                return;
            var oldBar = this.bar;
            this.bar++;
            if (this.enableOutro) {
                if (this.bar >= this.song.barCount) {
                    this.bar = this.enableIntro ? 0 : this.song.loopStart;
                }
            }
            else {
                if (this.bar >= this.song.loopStart + this.song.loopLength || this.bar >= this.song.barCount) {
                    this.bar = this.song.loopStart;
                }
            }
            this.playheadInternal += this.bar - oldBar;
        };
        Synth.prototype.prevBar = function () {
            if (!this.song)
                return;
            var oldBar = this.bar;
            this.bar--;
            if (this.bar < 0) {
                this.bar = this.song.loopStart + this.song.loopLength - 1;
            }
            if (this.bar >= this.song.barCount) {
                this.bar = this.song.barCount - 1;
            }
            if (this.bar < this.song.loopStart) {
                this.enableIntro = true;
            }
            if (!this.enableOutro && this.bar >= this.song.loopStart + this.song.loopLength) {
                this.bar = this.song.loopStart + this.song.loopLength - 1;
            }
            this.playheadInternal += this.bar - oldBar;
        };
        Synth.prototype.synthesize = function (dataLeft, dataRight, bufferLength) {
            if (this.song == null) {
                for (var i = 0; i < bufferLength; i++) {
                    dataLeft[i] = 0.0;
					dataRight[i] = 0.0;
                }
                return;
            }
            var channelCount = this.song.getChannelCount();
            for (var i = this.channels.length; i < channelCount; i++) {
                this.channels[i] = new SynthChannel();
            }
            this.channels.length = channelCount;
            var samplesPerArpeggio = this.getSamplesPerArpeggio();
            var bufferIndex = 0;
            var ended = false;
            if (this.arpeggioSampleCountdown == 0 || this.arpeggioSampleCountdown > samplesPerArpeggio) {
                this.arpeggioSampleCountdown = samplesPerArpeggio;
            }
            if (this.part >= this.song.partsPerBeat) {
                this.beat++;
                this.part = 0;
                this.arpeggio = 0;
                this.arpeggioSampleCountdown = samplesPerArpeggio;
            }
            if (this.beat >= this.song.beatsPerBar) {
                this.bar++;
                this.beat = 0;
                this.part = 0;
                this.arpeggio = 0;
                this.arpeggioSampleCountdown = samplesPerArpeggio;
                if (this.loopCount == -1) {
                    if (this.bar < this.song.loopStart && !this.enableIntro)
                        this.bar = this.song.loopStart;
                    if (this.bar >= this.song.loopStart + this.song.loopLength && !this.enableOutro)
                        this.bar = this.song.loopStart;
                }
            }
            if (this.bar >= this.song.barCount) {
                if (this.enableOutro) {
                    this.bar = 0;
                    this.enableIntro = true;
                    ended = true;
                    this.pause();
                }
                else {
                    this.bar = this.song.loopStart;
                }
            }
            if (this.bar >= this.song.loopStart) {
                this.enableIntro = false;
            }
            while (true) {
                if (ended) {
                    while (bufferIndex < bufferLength) {
                        dataLeft[bufferIndex] = 0.0;
						dataRight[bufferIndex] = 0.0;
                        bufferIndex++;
                    }
                    break;
                }
                var generatedSynthesizer = Synth.getGeneratedSynthesizer(this.song, this.bar);
                bufferIndex = generatedSynthesizer(this, this.song, dataLeft, dataRight, bufferLength, bufferIndex, samplesPerArpeggio);
                var finishedBuffer = (bufferIndex == -1);
                if (finishedBuffer) {
                    break;
                }
                else {
                    this.beat = 0;
                    this.effectPhase = 0.0;
                    this.bar++;
                    if (this.bar < this.song.loopStart) {
                        if (!this.enableIntro)
                            this.bar = this.song.loopStart;
                    }
                    else {
                        this.enableIntro = false;
                    }
                    if (this.bar >= this.song.loopStart + this.song.loopLength) {
                        if (this.loopCount > 0)
                            this.loopCount--;
                        if (this.loopCount > 0 || !this.enableOutro) {
                            this.bar = this.song.loopStart;
                        }
                    }
                    if (this.bar >= this.song.barCount) {
                        this.bar = 0;
                        this.enableIntro = true;
                        ended = true;
                        this.pause();
                    }
                }
            }
            this.playheadInternal = (((this.arpeggio + 1.0 - this.arpeggioSampleCountdown / samplesPerArpeggio) / 4.0 + this.part) / this.song.partsPerBeat + this.beat) / this.song.beatsPerBar + this.bar;
        };
        Synth.computeOperatorEnvelope = function (envelope, time, beats, customVolume) {
            switch (Config.operatorEnvelopeType[envelope]) {
                case 0: return customVolume;
                case 1: return 1.0;
                case 4:
                    var curve = 1.0 / (1.0 + time * Config.operatorEnvelopeSpeed[envelope]);
                    if (Config.operatorEnvelopeInverted[envelope]) {
                        return 1.0 - curve;
                    }
                    else {
                        return curve;
                    }
                case 5:
					if (Config.operatorSpecialCustomVolume[envelope]) {
						return 0.5 - Math.cos(beats * 2.0 * Math.PI * (customVolume * 4)) * 0.5;
					}
					else {
						return 0.5 - Math.cos(beats * 2.0 * Math.PI * Config.operatorEnvelopeSpeed[envelope]) * 0.5;
					}
                case 2:
                    return Math.max(1.0, 2.0 - time * 10.0);
                case 3:
                    var speed = Config.operatorEnvelopeSpeed[envelope];
					if (Config.operatorSpecialCustomVolume[envelope]) {
						var attack = 0.25 / Math.sqrt(customVolume);
						return time < attack ? time / attack : 1.0 / (1.0 + (time - attack) * (customVolume * 16));
					}
					else {
						var attack = 0.25 / Math.sqrt(speed);
						return time < attack ? time / attack : 1.0 / (1.0 + (time - attack) * speed);
					}
				case 6:
                    return Math.max(-1.0 - time, -2.0 + time);
                default: throw new Error("Unrecognized operator envelope type.");
            }
        };
        Synth.computeChannelInstrument = function (synth, song, channel, time, sampleTime, samplesPerArpeggio, samples) {
            var isDrum = song.getChannelIsDrum(channel);
            var synthChannel = synth.channels[channel];
            var pattern = song.getPattern(channel, synth.bar);
            var instrument = song.channels[channel].instruments[pattern == null ? 0 : pattern.instrument];
            var pianoMode = (synth.pianoPressed && channel == synth.pianoChannel);
            var basePitch = isDrum ? Config.drumBasePitches[instrument.wave] : Config.keyTransposes[song.key];
            var intervalScale = isDrum ? Config.drumInterval : 1;
            var pitchDamping = isDrum ? (Config.drumWaveIsSoft[instrument.wave] ? 24.0 : 60.0) : 48.0;
            var secondsPerPart = 4.0 * samplesPerArpeggio / synth.samplesPerSecond;
            var beatsPerPart = 1.0 / song.partsPerBeat;

            synthChannel.phaseDeltaScale = 0.0;
            synthChannel.filter = 1.0;
            synthChannel.filterScale = 1.0;
            synthChannel.vibratoScale = 0.0;
            synthChannel.harmonyMult = 1.0;
            synthChannel.harmonyVolumeMult = 1.0;
            var partsSinceStart = 0.0;
            var arpeggio = synth.arpeggio;
            var arpeggioSampleCountdown = synth.arpeggioSampleCountdown;
            var pitches = null;
            var resetPhases = true;
            var intervalStart = 0.0;
            var intervalEnd = 0.0;
            var transitionVolumeStart = 1.0;
            var transitionVolumeEnd = 1.0;
            var envelopeVolumeStart = 0.0;
            var envelopeVolumeEnd = 0.0;
            var partTimeStart = 0.0;
            var partTimeEnd = 0.0;
            var decayTimeStart = 0.0;
            var decayTimeEnd = 0.0;
            for (var i = 0; i < Config.operatorCount; i++) {
                synthChannel.phaseDeltas[i] = 0.0;
                synthChannel.volumeStarts[i] = 0.0;
                synthChannel.volumeDeltas[i] = 0.0;
				synthChannel.volumeLeft[0] = 0.0;
				synthChannel.volumeRight[0] = 0.0;
            }
            if (pianoMode) {
                pitches = synth.pianoPitch;
                transitionVolumeStart = transitionVolumeEnd = 1;
                envelopeVolumeStart = envelopeVolumeEnd = 1;
                resetPhases = false;
            }
            else if (pattern != null) {
                var note = null;
                var prevNote = null;
                var nextNote = null;
                for (var i = 0; i < pattern.notes.length; i++) {
                    if (pattern.notes[i].end <= time) {
                        prevNote = pattern.notes[i];
                    }
                    else if (pattern.notes[i].start <= time && pattern.notes[i].end > time) {
                        note = pattern.notes[i];
                    }
                    else if (pattern.notes[i].start > time) {
                        nextNote = pattern.notes[i];
                        break;
                    }
                }
                if (note != null && prevNote != null && prevNote.end != note.start)
                    prevNote = null;
                if (note != null && nextNote != null && nextNote.start != note.end)
                    nextNote = null;
                if (note != null) {
                    pitches = note.pitches;
                    partsSinceStart = time - note.start;
                    var endPinIndex = void 0;
                    for (endPinIndex = 1; endPinIndex < note.pins.length - 1; endPinIndex++) {
                        if (note.pins[endPinIndex].time + note.start > time)
                            break;
                    }
                    var startPin = note.pins[endPinIndex - 1];
                    var endPin = note.pins[endPinIndex];
                    var noteStart = note.start * 4;
                    var noteEnd = note.end * 4;
                    var pinStart = (note.start + startPin.time) * 4;
                    var pinEnd = (note.start + endPin.time) * 4;
                    var tickTimeStart = time * 4 + arpeggio;
                    var tickTimeEnd = time * 4 + arpeggio + 1;
                    var pinRatioStart = (tickTimeStart - pinStart) / (pinEnd - pinStart);
                    var pinRatioEnd = (tickTimeEnd - pinStart) / (pinEnd - pinStart);
                    var envelopeVolumeTickStart = startPin.volume + (endPin.volume - startPin.volume) * pinRatioStart;
                    var envelopeVolumeTickEnd = startPin.volume + (endPin.volume - startPin.volume) * pinRatioEnd;
                    var transitionVolumeTickStart = 1.0;
                    var transitionVolumeTickEnd = 1.0;
                    var intervalTickStart = startPin.interval + (endPin.interval - startPin.interval) * pinRatioStart;
                    var intervalTickEnd = startPin.interval + (endPin.interval - startPin.interval) * pinRatioEnd;
                    var partTimeTickStart = startPin.time + (endPin.time - startPin.time) * pinRatioStart;
                    var partTimeTickEnd = startPin.time + (endPin.time - startPin.time) * pinRatioEnd;
                    var decayTimeTickStart = partTimeTickStart;
                    var decayTimeTickEnd = partTimeTickEnd;
                    var startRatio = 1.0 - (arpeggioSampleCountdown + samples) / samplesPerArpeggio;
                    var endRatio = 1.0 - (arpeggioSampleCountdown) / samplesPerArpeggio;
                    resetPhases = (tickTimeStart + startRatio - noteStart == 0.0);
                    var transition = instrument.transition;
                    if (tickTimeStart == noteStart) {
                        if (transition == 0) {
                            resetPhases = false;
                        }
                        else if (transition == 2) {
                            transitionVolumeTickStart = 0.0;
                        }
                        else if (transition == 3) {
                            if (prevNote == null) {
                                transitionVolumeTickStart = 0.0;
                            }
                            else if (prevNote.pins[prevNote.pins.length - 1].volume == 0 || note.pins[0].volume == 0) {
                                transitionVolumeTickStart = 0.0;
                            }
                            else {
                                intervalTickStart = (prevNote.pitches[0] + prevNote.pins[prevNote.pins.length - 1].interval - note.pitches[0]) * 0.5;
                                decayTimeTickStart = prevNote.pins[prevNote.pins.length - 1].time * 0.5;
                                resetPhases = false;
                            }
                        }
						else if (transition == 4) {
							transitionVolumeTickEnd = 0.0
						}
	                    else if (transition == 5) {
							intervalTickStart = 100.0
						}
	                    else if (transition == 6) {
							intervalTickStart = -1.0
						}
						else if (transition == 7) {
							transitionVolumeTickStart = 6.0;
						}
                    }
                    if (tickTimeEnd == noteEnd) {
                        if (transition == 0) {
                            if (nextNote == null && note.start + endPin.time != song.partsPerBeat * song.beatsPerBar) {
                                transitionVolumeTickEnd = 0.0;
                            }
                        }
                        else if (transition == 1 || transition == 2) {
                            transitionVolumeTickEnd = 0.0;
                        }
                        else if (transition == 3) {
                            if (nextNote == null) {
                                transitionVolumeTickEnd = 0.0;
                            }
                            else if (note.pins[note.pins.length - 1].volume == 0 || nextNote.pins[0].volume == 0) {
                                transitionVolumeTickEnd = 0.0;
                            }
                            else {
                                intervalTickEnd = (nextNote.pitches[0] - note.pitches[0] + note.pins[note.pins.length - 1].interval) * 0.5;
                                decayTimeTickEnd *= 0.5;
                            }
                        }
                    }
                    intervalStart = intervalTickStart + (intervalTickEnd - intervalTickStart) * startRatio;
                    intervalEnd = intervalTickStart + (intervalTickEnd - intervalTickStart) * endRatio;
                    envelopeVolumeStart = synth.volumeConversion(envelopeVolumeTickStart + (envelopeVolumeTickEnd - envelopeVolumeTickStart) * startRatio);
                    envelopeVolumeEnd = synth.volumeConversion(envelopeVolumeTickStart + (envelopeVolumeTickEnd - envelopeVolumeTickStart) * endRatio);
                    transitionVolumeStart = transitionVolumeTickStart + (transitionVolumeTickEnd - transitionVolumeTickStart) * startRatio;
                    transitionVolumeEnd = transitionVolumeTickStart + (transitionVolumeTickEnd - transitionVolumeTickStart) * endRatio;
                    partTimeStart = note.start + partTimeTickStart + (partTimeTickEnd - partTimeTickStart) * startRatio;
                    partTimeEnd = note.start + partTimeTickStart + (partTimeTickEnd - partTimeTickStart) * endRatio;
                    decayTimeStart = decayTimeTickStart + (decayTimeTickEnd - decayTimeTickStart) * startRatio;
                    decayTimeEnd = decayTimeTickStart + (decayTimeTickEnd - decayTimeTickStart) * endRatio;
                }
            }
            if (pitches != null) {
                if (!isDrum && instrument.type == 1) {
                    var sineVolumeBoost = 1.0;
                    var totalCarrierVolume = 0.0;
                    var carrierCount = Config.operatorCarrierCounts[instrument.algorithm];
                    for (var i = 0; i < Config.operatorCount; i++) {
						var isCarrier = (i < Config.operatorCarrierCounts[instrument.algorithm]);
                        var associatedCarrierIndex = Config.operatorAssociatedCarrier[instrument.algorithm][i] - 1;
                        var pitch = pitches[(i < pitches.length) ? i : ((associatedCarrierIndex < pitches.length) ? associatedCarrierIndex : 0)] + beepbox.Config.octaveOffsetValues[instrument.octaveOffset] + (song.detune / 24);
                        var freqMult = Config.operatorFrequencies[instrument.operators[i].frequency];
                        var chorusInterval = Config.operatorCarrierChorus[Config.fmChorusNames[instrument.fmChorus]][associatedCarrierIndex];
                        var startPitch = (pitch + intervalStart) * intervalScale + chorusInterval;
                        var startFreq = freqMult * (synth.frequencyFromPitch(basePitch + startPitch)) + Config.operatorHzOffsets[instrument.operators[i].frequency];
                        synthChannel.phaseDeltas[i] = startFreq * sampleTime * Config.sineWaveLength;
                        if (resetPhases)
                            synthChannel.reset();
						var amplitudeCurve = Synth.operatorAmplitudeCurve(instrument.operators[i].amplitude);
						if ((Config.volumeValues[instrument.volume] != -1.0 && song.mix == 2) || (Config.volumeMValues[instrument.volume] != -1.0 && song.mix != 2)) {
							if (song.mix == 2)
								var amplitudeMult = isCarrier ? (amplitudeCurve * Config.operatorAmplitudeSigns[instrument.operators[i].frequency]) * ((1 - (Config.volumeValues[instrument.volume] / 2.3))) : (amplitudeCurve * Config.operatorAmplitudeSigns[instrument.operators[i].frequency]);
							else
								var amplitudeMult = (amplitudeCurve * Config.operatorAmplitudeSigns[instrument.operators[i].frequency]) * ((1 - (Config.volumeMValues[instrument.volume] / 2.3)));
						}
						else if (Config.volumeValues[instrument.volume] != -1.0) {
							var amplitudeMult = 0;
						}
						else if (Config.volumeMValues[instrument.volume] != -1.0) {
							var amplitudeMult = 0;
						}
                        var volumeStart = amplitudeMult * Config.muteValues[instrument.muteState];
                        var volumeEnd = amplitudeMult * Config.muteValues[instrument.muteState];
						synthChannel.volumeLeft[0] = Math.min(1, 1 + Config.panValues[instrument.pan]);
						synthChannel.volumeRight[0] = Math.min(1, 1 - Config.panValues[instrument.pan]);
                        if (i < carrierCount) {
                            var volumeMult = 0.03;
                            var endPitch = (pitch + intervalEnd) * intervalScale;
							if (song.mix == 3) {
                            var pitchVolumeStart = Math.pow(5.0, -startPitch / pitchDamping);
                            var pitchVolumeEnd = Math.pow(5.0, -endPitch / pitchDamping);
							} else {
							var pitchVolumeStart = Math.pow(2.0, -startPitch / pitchDamping);
                            var pitchVolumeEnd = Math.pow(2.0, -endPitch / pitchDamping);
							}
                            volumeStart *= pitchVolumeStart * volumeMult * transitionVolumeStart;
                            volumeEnd *= pitchVolumeEnd * volumeMult * transitionVolumeEnd;
                            totalCarrierVolume += amplitudeCurve;
                        }
                        else {
                            volumeStart *= Config.sineWaveLength * 1.5;
                            volumeEnd *= Config.sineWaveLength * 1.5;
                            sineVolumeBoost *= 1.0 - Math.min(1.0, instrument.operators[i].amplitude / 15);
                        }
                        var envelope = instrument.operators[i].envelope;
                        volumeStart *= Synth.computeOperatorEnvelope(envelope, secondsPerPart * decayTimeStart, beatsPerPart * partTimeStart, envelopeVolumeStart);
                        volumeEnd *= Synth.computeOperatorEnvelope(envelope, secondsPerPart * decayTimeEnd, beatsPerPart * partTimeEnd, envelopeVolumeEnd);
                        synthChannel.volumeStarts[i] = volumeStart;
                        synthChannel.volumeDeltas[i] = (volumeEnd - volumeStart) / samples;
                    }
                    var feedbackAmplitude = Config.sineWaveLength * 0.3 * instrument.feedbackAmplitude / 15.0;
                    var feedbackStart = feedbackAmplitude * Synth.computeOperatorEnvelope(instrument.feedbackEnvelope, secondsPerPart * decayTimeStart, beatsPerPart * partTimeStart, envelopeVolumeStart);
                    var feedbackEnd = feedbackAmplitude * Synth.computeOperatorEnvelope(instrument.feedbackEnvelope, secondsPerPart * decayTimeEnd, beatsPerPart * partTimeEnd, envelopeVolumeEnd);
                    synthChannel.feedbackMult = feedbackStart;
                    synthChannel.feedbackDelta = (feedbackEnd - synthChannel.feedbackMult) / samples;
                    sineVolumeBoost *= 1.0 - instrument.feedbackAmplitude / 15.0;
                    sineVolumeBoost *= 1.0 - Math.min(1.0, Math.max(0.0, totalCarrierVolume - 1) / 2.0);
                    for (var i = 0; i < carrierCount; i++) {
                        synthChannel.volumeStarts[i] *= 1.0 + sineVolumeBoost * 3.0;
                        synthChannel.volumeDeltas[i] *= 1.0 + sineVolumeBoost * 3.0;
                    }
                }
                else {
                    var pitch = pitches[0];
					if (!isDrum) {
						if (Config.harmNames[instrument.harm] == 1) {
							var harmonyOffset = 0.0;
							if (pitches.length == 2) {
								harmonyOffset = (pitches[1] - pitches[0]);
							}
							else if (pitches.length == 3) {
								harmonyOffset = (pitches[(arpeggio >> 1) + 1] - pitches[0]);
							}
							else if (pitches.length == 4) {
								harmonyOffset = pitches[(arpeggio == 3 ? 1 : arpeggio) + 1] - pitches[0];
							}
							synthChannel.harmonyMult = Math.pow(2.0, harmonyOffset / 12.0);
							synthChannel.harmonyVolumeMult = Math.pow(2.0, -harmonyOffset / pitchDamping);
						}
						else if (Config.harmNames[instrument.harm] == 2) {
							var harmonyOffset = 0.0;
							if (pitches.length == 2) {
								harmonyOffset = pitches[1] - pitches[0];
							}
							else if (pitches.length == 3) {
								harmonyOffset = (pitches[2] - pitches[0]);
							}
							else if (pitches.length == 4) {
								harmonyOffset = pitches[(arpeggio == 3 ? 2 : arpeggio) + 1] - pitches[0];
							}
							synthChannel.harmonyMult = Math.pow(2.0, harmonyOffset / 12.0);
							synthChannel.harmonyVolumeMult = Math.pow(2.0, -harmonyOffset / pitchDamping);
						}
						else if (Config.harmNames[instrument.harm] == 3) {
							var harmonyOffset = 0.0;
							if (pitches.length == 2) {
								harmonyOffset = pitches[1] - pitches[0];
							}
							else if (pitches.length == 3) {
								harmonyOffset = (pitches[2] - pitches[0]);
							}
							else if (pitches.length == 4) {
								harmonyOffset = (pitches[3] - pitches[0]);
							}
							synthChannel.harmonyMult = Math.pow(2.0, harmonyOffset / 12.0);
							synthChannel.harmonyVolumeMult = Math.pow(2.0, -harmonyOffset / pitchDamping);
						}
						var pitch = pitches[0];
						 if (Config.harmNames[instrument.harm] == 4) {
							var harmonyOffset = 0.0;
							if (pitches.length == 2) {
								harmonyOffset = pitches[1] - pitches[0];
							}
							else if (pitches.length == 3) {
								harmonyOffset = pitches[(arpeggio >> 1) + 1] - pitches[0];
							}
							else if (pitches.length == 4) {
								harmonyOffset = pitches[(arpeggio >> 1) + 2] - pitches[0];
							}
							synthChannel.harmonyMult = Math.pow(2.0, harmonyOffset / 12.0);
							synthChannel.harmonyVolumeMult = Math.pow(2.0, -harmonyOffset / pitchDamping);
						}
						else if (Config.harmNames[instrument.harm] == 5) {
							var harmonyOffset = 0.0;
							if (pitches.length == 2) {
								harmonyOffset = pitches[1] - pitches[0];
							}
							else if (pitches.length == 3) {
								harmonyOffset = (pitches[2] - pitches[0]);
							}
							else if (pitches.length == 4) {
								harmonyOffset = (pitches[(arpeggio == 3 ? 2 : arpeggio)] - pitches[0]);
							}
							synthChannel.harmonyMult = Math.pow(2.0, harmonyOffset / 12.0);
							synthChannel.harmonyVolumeMult = Math.pow(2.0, -harmonyOffset / pitchDamping);
						}
						else if (Config.harmNames[instrument.harm] == 0) {
							if (pitches.length == 2) {
								pitch = pitches[arpeggio >> 1];
							}
							else if (pitches.length == 3) {
								pitch = pitches[arpeggio == 3 ? 1 : arpeggio];
							}
							else if (pitches.length == 4) {
								pitch = pitches[arpeggio];
							}
						}
					}
					if (isDrum) {
						if (Config.harmNames[instrument.harm] == 0) {
							if (pitches.length == 1) {
								pitch = pitches[0] + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							if (pitches.length == 2) {
								pitch = pitches[arpeggio >> 1] + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							else if (pitches.length == 3) {
								pitch = pitches[arpeggio == 3 ? 1 : arpeggio] + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							else if (pitches.length == 4) {
								pitch = pitches[arpeggio] + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
						}
						if (Config.harmNames[instrument.harm] == 1) {
							if (pitches.length == 1) {
								pitch = pitches[0] + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							if (pitches.length == 2) {
								pitch = (pitches[1] + pitches[0]) / 2 + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							else if (pitches.length == 3) {
								pitch = (pitches[(arpeggio >> 1) + 1] + pitches[0]) / 2 + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							else if (pitches.length == 4) {
								pitch = (pitches[(arpeggio == 3 ? 1 : arpeggio) + 1] + pitches[0]) / 2 + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
						}
						if (Config.harmNames[instrument.harm] == 2) {
							if (pitches.length == 1) {
								pitch = pitches[0] + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							if (pitches.length == 2) {
								pitch = (pitches[1] + pitches[0]) / 2 + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							else if (pitches.length == 3) {
								pitch = (pitches[2] + pitches[0]) / 2 + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							else if (pitches.length == 4) {
								pitch = (pitches[(arpeggio == 3 ? 2 : arpeggio) + 1] + pitches[0]) / 2 + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
						}
						if (Config.harmNames[instrument.harm] == 3) {
							if (pitches.length == 1) {
								pitch = pitches[0] + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							if (pitches.length == 2) {
								pitch = (pitches[1] + pitches[0]) / 2 + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							else if (pitches.length == 3) {
								pitch = (pitches[2] + pitches[0]) / 2 + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							else if (pitches.length == 4) {
								pitch = (pitches[3] + pitches[0]) / 2 + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
						}
						if (Config.harmNames[instrument.harm] == 4) {
							if (pitches.length == 1) {
								pitch = pitches[0] + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							if (pitches.length == 2) {
								pitch = (pitches[1] + pitches[0]) / 2 + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							else if (pitches.length == 3) {
								pitch = (pitches[(arpeggio >> 1) + 1] + pitches[0]) / 2 + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
							else if (pitches.length == 4) {
								pitch = pitches[(arpeggio >> 1) + 2] + pitches[0] + beepbox.Config.octaveOffsetValues[instrument.octaveOffset];
							}
						}
					}
                    var startPitch = (pitch + intervalStart) * intervalScale;
                    var endPitch = (pitch + intervalEnd) * intervalScale;
                    var startFreq = synth.frequencyFromPitch(basePitch + startPitch);
                    var pitchVolumeStart = Math.pow(2.0, -startPitch / pitchDamping);
                    var pitchVolumeEnd = Math.pow(2.0, -endPitch / pitchDamping);
                    if (isDrum && Config.drumWaveIsSoft[instrument.wave]) {
                        synthChannel.filter = Math.min(1.0, startFreq * sampleTime * Config.drumPitchFilterMult[instrument.wave]);
					}
                    var settingsVolumeMult = void 0;
                    if (!isDrum) {
                        var filterScaleRate = Config.filterDecays[instrument.filter];
                        synthChannel.filter = Math.pow(2, -filterScaleRate * secondsPerPart * decayTimeStart)
						if (synthChannel.filterScaleRate < 0) {
							var endFilter = Math.pow(2, -filterScaleRate * secondsPerPart * decayTimeEnd);
						}
						else {
							var endFilter = Math.pow(2, -filterScaleRate * secondsPerPart * decayTimeEnd);
						}
                        synthChannel.filterScale = Math.pow(endFilter / synthChannel.filter, 1.0 / samples);
                        settingsVolumeMult = 0.27 * 0.5 * Config.waveVolumes[instrument.wave] * Config.filterVolumes[instrument.filter] * Config.chorusVolumes[instrument.chorus];
                    }
                    else {
						if (song.mix == 0) {
							settingsVolumeMult = 0.19 * Config.drumVolumes[instrument.wave];
						}
						else if (song.mix == 3) {
							settingsVolumeMult = (0.12 * Config.drumVolumes[instrument.wave]);
						}
						else {
							settingsVolumeMult = 0.09 * Config.drumVolumes[instrument.wave];
						}
                    }
                    if (resetPhases && !isDrum) {
                        synthChannel.reset();
                    }
                    synthChannel.phaseDeltas[0] = startFreq * sampleTime;
					if (song.mix == 2)
						var instrumentVolumeMult = (instrument.volume == 9) ? 0.0 : Math.pow(3, -Config.volumeValues[instrument.volume]) * Config.muteValues[instrument.muteState];
					else if (song.mix == 1)
						var instrumentVolumeMult = (instrument.volume >= 5) ? 0.0 : Math.pow(3, -Config.volumeMValues[instrument.volume]) * Config.muteValues[instrument.muteState];
					else
						var instrumentVolumeMult = (instrument.volume >= 5) ? 0.0 : Math.pow(2, -Config.volumeMValues[instrument.volume]) * Config.muteValues[instrument.muteState];
                    synthChannel.volumeStarts[0] = transitionVolumeStart * envelopeVolumeStart * pitchVolumeStart * settingsVolumeMult * instrumentVolumeMult;
                    var volumeEnd = transitionVolumeEnd * envelopeVolumeEnd * pitchVolumeEnd * settingsVolumeMult * instrumentVolumeMult;
                    synthChannel.volumeDeltas[0] = (volumeEnd - synthChannel.volumeStarts[0]) / samples;
					synthChannel.volumeLeft[0] = Math.min(1, 1 + Config.panValues[instrument.pan]);
					synthChannel.volumeRight[0] = Math.min(1, 1 - Config.panValues[instrument.pan]);
                }
                synthChannel.phaseDeltaScale = Math.pow(2.0, ((intervalEnd - intervalStart) * intervalScale / 12.0) / samples);
                synthChannel.vibratoScale = (partsSinceStart < Config.effectVibratoDelays[instrument.effect]) ? 0.0 : Math.pow(2.0, Config.effectVibratos[instrument.effect] / 12.0) - 1.0;
            }
            else {
                synthChannel.reset();
                for (var i = 0; i < Config.operatorCount; i++) {
                    synthChannel.phaseDeltas[0] = 0.0;
                    synthChannel.volumeStarts[0] = 0.0;
                    synthChannel.volumeDeltas[0] = 0.0;
					synthChannel.volumeLeft[0] = 0.0;
					synthChannel.volumeRight[0] = 0.0;
                }
            }
        };
        Synth.getGeneratedSynthesizer = function (song, bar) {
            var fingerprint = song.getChannelFingerprint(bar);
            if (Synth.generatedSynthesizers[fingerprint] == undefined) {
                var synthSource = [];
                var instruments = [];
                for (var channel = 0; channel < song.pitchChannelCount; channel++) {
                    instruments[channel] = song.channels[channel].instruments[song.getPatternInstrument(channel, bar)];
                }
                for (var _i = 0, _a = Synth.synthSourceTemplate; _i < _a.length; _i++) {
                    var line = _a[_i];
                    if (line.indexOf("#") != -1) {
                        if (line.indexOf("// PITCH") != -1) {
                            for (var channel = 0; channel < song.pitchChannelCount; channel++) {
                                synthSource.push(line.replace(/#/g, channel + ""));
                            }
                        }
                        else if (line.indexOf("// JCHIP") != -1) {
                            for (var channel = 0; channel < song.pitchChannelCount; channel++) {
                                if (instruments[channel].type == 0) {
                                    synthSource.push(line.replace(/#/g, channel + ""));
                                }
                            }
                        }
                        else if (line.indexOf("// CHIP") != -1) {
                            for (var channel = 0; channel < song.pitchChannelCount; channel++) {
                                if (instruments[channel].type == 0) {
                                    synthSource.push(line.replace(/#/g, channel + ""));
                                }
                                else if (instruments[channel].type == 2) {
                                    synthSource.push(line.replace(/#/g, channel + ""));
                                }
                            }
                        }
                        else if (line.indexOf("// FM") != -1) {
                            for (var channel = 0; channel < song.pitchChannelCount; channel++) {
                                if (instruments[channel].type == 1) {
                                    if (line.indexOf("$") != -1) {
                                        for (var j = 0; j < Config.operatorCount; j++) {
                                            synthSource.push(line.replace(/#/g, channel + "").replace(/\$/g, j + ""));
                                        }
                                    }
                                    else {
                                        synthSource.push(line.replace(/#/g, channel + ""));
                                    }
                                }
                            }
                        }
                        else if (line.indexOf("// PWM") != -1) {
                            for (var channel = 0; channel < song.pitchChannelCount; channel++) {
                                if (instruments[channel].type == 2) {
                                    synthSource.push(line.replace(/#/g, channel + ""));
                                }
                            }
                        }
                        else if (line.indexOf("// CARRIER OUTPUTS") != -1) {
                            for (var channel = 0; channel < song.pitchChannelCount; channel++) {
                                if (instruments[channel].type == 1) {
                                    var outputs = [];
                                    for (var j = 0; j < Config.operatorCarrierCounts[instruments[channel].algorithm]; j++) {
                                        outputs.push("channel" + channel + "Operator" + j + "Scaled");
                                    }
                                    synthSource.push(line.replace(/#/g, channel + "").replace("/*channel" + channel + "Operator$Scaled*/", outputs.join(" + ")));
                                }
                            }
                        }
                        else if (line.indexOf("// NOISE") != -1) {
                            for (var channel = song.pitchChannelCount; channel < song.pitchChannelCount + song.drumChannelCount; channel++) {
                                synthSource.push(line.replace(/#/g, channel + ""));
                            }
                        }
                        else if (line.indexOf("// ALL") != -1) {
                            for (var channel = 0; channel < song.pitchChannelCount + song.drumChannelCount; channel++) 
								synthSource.push(line.replace(/#/g, channel + ""));
                        }
                        else {
                            throw new Error("Missing channel type annotation for line: " + line);
                        }
                    }
                    else if (line.indexOf("// INSERT OPERATOR COMPUTATION HERE") != -1) {
                        for (var j = Config.operatorCount - 1; j >= 0; j--) {
                            for (var _b = 0, _c = Synth.operatorSourceTemplate; _b < _c.length; _b++) {
                                var operatorLine = _c[_b];
                                for (var channel = 0; channel < song.pitchChannelCount; channel++) {
                                    if (instruments[channel].type == 1) {
                                        if (operatorLine.indexOf("/* + channel#Operator@Scaled*/") != -1) {
                                            var modulators = "";
                                            for (var _d = 0, _e = Config.operatorModulatedBy[instruments[channel].algorithm][j]; _d < _e.length; _d++) {
                                                var modulatorNumber = _e[_d];
                                                modulators += " + channel" + channel + "Operator" + (modulatorNumber - 1) + "Scaled";
                                            }
                                            var feedbackIndices = Config.operatorFeedbackIndices[instruments[channel].feedbackType][j];
                                            if (feedbackIndices.length > 0) {
                                                modulators += " + channel" + channel + "FeedbackMult * (";
                                                var feedbacks = [];
                                                for (var _f = 0, feedbackIndices_1 = feedbackIndices; _f < feedbackIndices_1.length; _f++) {
                                                    var modulatorNumber = feedbackIndices_1[_f];
                                                    feedbacks.push("channel" + channel + "Operator" + (modulatorNumber - 1) + "Output");
                                                }
                                                modulators += feedbacks.join(" + ") + ")";
                                            }
                                            synthSource.push(operatorLine.replace(/#/g, channel + "").replace(/\$/g, j + "").replace("/* + channel" + channel + "Operator@Scaled*/", modulators));
                                        }
                                        else {
                                            synthSource.push(operatorLine.replace(/#/g, channel + "").replace(/\$/g, j + ""));
                                        }
                                    }
                                }
                            }
                        }
                    }
                    else {
                        synthSource.push(line);
                    }
                }
                Synth.generatedSynthesizers[fingerprint] = new Function("synth", "song", "dataLeft", "dataRight", "bufferLength", "bufferIndex", "samplesPerArpeggio", synthSource.join("\n"));
            }
            return Synth.generatedSynthesizers[fingerprint];
        };
        Synth.prototype.frequencyFromPitch = function (pitch) {
            return 440.0 * Math.pow(2.0, (pitch - 69.0) / 12.0);
        };
        Synth.prototype.volumeConversion = function (noteVolume) {
            return Math.pow(noteVolume / 3.0, 1.5);
        };
        Synth.prototype.getSamplesPerArpeggio = function () {
            if (this.song == null)
                return 0;
            var beatsPerMinute = this.song.getBeatsPerMinute();
            var beatsPerSecond = beatsPerMinute / 60.0;
            var partsPerSecond = beatsPerSecond * this.song.partsPerBeat;
            var arpeggioPerSecond = partsPerSecond * 4.0;
            return Math.floor(this.samplesPerSecond / arpeggioPerSecond);
        };
        return Synth;
    }());
    Synth.negativePhaseGuard = 1000;
    Synth.generatedSynthesizers = {};
    Synth.synthSourceTemplate = ("\n\t\t\tvar sampleTime = 1.0 / synth.samplesPerSecond;\n\t\t\tvar effectYMult = +synth.effectYMult;\n\t\t\tvar limitDecay = +synth.limitDecay;\n\t\t\tvar volume = +synth.volume;\n\t\t\tvar delayLineLeft = synth.delayLineLeft;\n\t\t\tvar delayLineRight = synth.delayLineRight;\n\t\t\tvar reverb = Math.pow(song.reverb / beepbox.Config.reverbRange, 0.667) * 0.425;\n\t\t\tvar blend = Math.pow(song.blend / beepbox.Config.blendRange, 0.667) * 0.425;\n\t\t\tvar mix = song.mix;\n\t\t\tvar muff = Math.pow(song.muff / beepbox.Config.muffRange, 0.667) * 0.425;\n\t\t\tvar detune = song.detune;\n\t\t\tvar riff = Math.pow(song.riff / beepbox.Config.riffRange, 0.667) * 0.425; \n\t\t\tvar sineWave = beepbox.Config.sineWave;\n\t\t\t\n\t\t\t// Initialize instruments based on current pattern.\n\t\t\tvar instrumentChannel# = song.getPatternInstrument(#, synth.bar); // ALL\n\t\t\tvar instrument# = song.channels[#].instruments[instrumentChannel#]; // ALL\n\t\t\tvar channel#Wave = (mix <= 1) ? beepbox.Config.waves[instrument#.wave] : beepbox.Config.wavesMixC[instrument#.wave]; // CHIP\n\t\t\tvar channel#Wave = beepbox.Config.getDrumWave(instrument#.wave); // NOISE\n\t\t\tvar channel#WaveLength = channel#Wave.length; // CHIP\n\t\t\tvar channel#Wave = beepbox.Config.pwmwaves[instrument#.wave]; // PWM\n\t\t\tvar channel#WaveLength = channel#Wave.length; // CHIP\n\t\t\tvar channel#FilterBase = (song.mix == 2) ? Math.pow(2 - (blend * 2) + (muff * 2), -beepbox.Config.filterBases[instrument#.filter]) : Math.pow(2, -beepbox.Config.filterBases[instrument#.filter] + (blend * 4) - (muff * 4)); // CHIP\n\t\t\tvar channel#TremoloScale = beepbox.Config.effectTremolos[instrument#.effect]; // PITCH\n\t\t\t\n\t\t\twhile (bufferIndex < bufferLength) {\n\t\t\t\t\n\t\t\t\tvar samples;\n\t\t\t\tvar samplesLeftInBuffer = bufferLength - bufferIndex;\n\t\t\t\tif (synth.arpeggioSampleCountdown <= samplesLeftInBuffer) {\n\t\t\t\t\tsamples = synth.arpeggioSampleCountdown;\n\t\t\t\t} else {\n\t\t\t\t\tsamples = samplesLeftInBuffer;\n\t\t\t\t}\n\t\t\t\tsynth.arpeggioSampleCountdown -= samples;\n\t\t\t\t\n\t\t\t\tvar time = synth.part + synth.beat * song.partsPerBeat;\n\t\t\t\t\n\t\t\t\tbeepbox.Synth.computeChannelInstrument(synth, song, #, time, sampleTime, samplesPerArpeggio, samples); // ALL\n\t\t\t\tvar synthChannel# = synth.channels[#]; // ALL\n\t\t\t\t\n\t\t\t\tvar channel#ChorusA = Math.pow(2.0, (beepbox.Config.chorusOffsets[instrument#.chorus] + beepbox.Config.chorusIntervals[instrument#.chorus] + beepbox.Config.octoffValues[instrument#.octoff] + (detune / 24) * ((riff * beepbox.Config.chorusRiffApp[instrument#.chorus]) + 1)) / 12.0); // CHIP\n\t\t\t\tvar channel#ChorusB = Math.pow(2.0, (beepbox.Config.chorusOffsets[instrument#.chorus] - beepbox.Config.chorusIntervals[instrument#.chorus] + beepbox.Config.octoffValues[instrument#.octoff] + (detune / 24) * ((riff * beepbox.Config.chorusRiffApp[instrument#.chorus]) + 1)) / 12.0); // CHIP\n\t\t\t\tvar channel#ChorusSign = synthChannel#.harmonyVolumeMult * (beepbox.Config.chorusSigns[instrument#.chorus]); // CHIP\n\t\t\t\tchannel#ChorusB *= synthChannel#.harmonyMult; // CHIP\n\t\t\t\tvar channel#ChorusDeltaRatio = channel#ChorusB / channel#ChorusA * ((riff * beepbox.Config.chorusRiffApp[instrument#.chorus]) + 1); // CHIP\n\t\t\t\t\n\t\t\t\tvar channel#PhaseDelta = synthChannel#.phaseDeltas[0] * channel#ChorusA * ((riff * beepbox.Config.chorusRiffApp[instrument#.chorus]) + 1); // CHIP\n\t\t\t\tvar channel#PhaseDelta = synthChannel#.phaseDeltas[0] / 32768.0; // NOISE\n\t\t\t\tvar channel#PhaseDeltaScale = synthChannel#.phaseDeltaScale; // ALL\n\t\t\t\tvar channel#Volume = synthChannel#.volumeStarts[0]; // CHIP\n\t\t\t\tvar channel#Volume = synthChannel#.volumeStarts[0]; // NOISE\n\t\t\t\tvar channel#VolumeLeft = synthChannel#.volumeLeft[0]; // ALL\n\t\t\t\tvar channel#VolumeRight = synthChannel#.volumeRight[0]; // ALL\n\t\t\t\tvar channel#VolumeDelta = synthChannel#.volumeDeltas[0]; // CHIP\n\t\t\t\tvar channel#VolumeDelta = synthChannel#.volumeDeltas[0]; // NOISE\n\t\t\t\tvar channel#Filter = synthChannel#.filter * channel#FilterBase; // CHIP\n\t\t\t\tvar channel#Filter = synthChannel#.filter; // NOISE\n\t\t\t\tvar channel#FilterScale = synthChannel#.filterScale; // CHIP\n\t\t\t\tvar channel#VibratoScale = synthChannel#.vibratoScale; // PITCH\n\t\t\t\t\n\t\t\t\tvar effectY     = Math.sin(synth.effectPhase);\n\t\t\t\tvar prevEffectY = Math.sin(synth.effectPhase - synth.effectAngle);\n\t\t\t\t\n\t\t\t\tvar channel#PhaseA = synth.channels[#].phases[0] % 1; // CHIP\n\t\t\t\tvar channel#PhaseB = synth.channels[#].phases[1] % 1; // CHIP\n\t\t\t\tvar channel#Phase  = synth.channels[#].phases[0] % 1; // NOISE\n\t\t\t\t\n\t\t\t\tvar channel#Operator$Phase       = ((synth.channels[#].phases[$] % 1) + " + Synth.negativePhaseGuard + ") * " + Config.sineWaveLength + "; // FM\n\t\t\t\tvar channel#Operator$PhaseDelta  = synthChannel#.phaseDeltas[$]; // FM\n\t\t\t\tvar channel#Operator$OutputMult  = synthChannel#.volumeStarts[$]; // FM\n\t\t\t\tvar channel#Operator$OutputDelta = synthChannel#.volumeDeltas[$]; // FM\n\t\t\t\tvar channel#Operator$Output      = synthChannel#.feedbackOutputs[$]; // FM\n\t\t\t\tvar channel#FeedbackMult         = synthChannel#.feedbackMult; // FM\n\t\t\t\tvar channel#FeedbackDelta        = synthChannel#.feedbackDelta; // FM\n\t\t\t\t\n\t\t\t\tvar channel#SampleLeft = +synth.channels[#].sampleLeft; // ALL\n\t\t\t\tvar channel#SampleRight = +synth.channels[#].sampleRight; // ALL\n\t\t\t\t\n\t\t\t\tvar delayPosLeft = 0|synth.delayPosLeft;\n\t\t\t\tvar delayFeedback0Left = +synth.delayFeedback0Left;\n\t\t\t\tvar delayFeedback1Left = +synth.delayFeedback1Left;\n\t\t\t\tvar delayFeedback2Left = +synth.delayFeedback2Left;\n\t\t\t\tvar delayFeedback3Left = +synth.delayFeedback3Left;\n\t\t\t\tvar delayPosRight = 0|synth.delayPosRight;\n\t\t\t\tvar delayFeedback0Right = +synth.delayFeedback0Right;\n\t\t\t\tvar delayFeedback1Right = +synth.delayFeedback1Right;\n\t\t\t\tvar delayFeedback2Right = +synth.delayFeedback2Right;\n\t\t\t\tvar delayFeedback3Right = +synth.delayFeedback3Right;\n\t\t\t\tvar limit = +synth.limit;\n\t\t\t\t\n\t\t\t\twhile (samples) {\n\t\t\t\t\tvar channel#Vibrato = 1.0 + channel#VibratoScale * effectY; // PITCH\n\t\t\t\t\tvar channel#Tremolo = 1.0 + channel#TremoloScale * (effectY - 1.0); // PITCH\n\t\t\t\t\tvar temp = effectY;\n\t\t\t\t\teffectY = effectYMult * effectY - prevEffectY;\n\t\t\t\t\tprevEffectY = temp;\n\t\t\t\t\t\n\t\t\t\t\tchannel#SampleLeft += ((channel#Wave[0|(channel#PhaseA * channel#WaveLength)] + channel#Wave[0|(channel#PhaseB * channel#WaveLength)] * channel#ChorusSign) * channel#Volume * channel#Tremolo - channel#SampleLeft) * channel#Filter * channel#VolumeLeft; // CHIP \n\t\t\t\t\tchannel#SampleLeft += (channel#Wave[0|(channel#Phase * 32768.0)] * channel#Volume - channel#SampleLeft) * channel#Filter * channel#VolumeLeft; // NOISE\n\t\t\t\t\tchannel#SampleRight += ((channel#Wave[0|(channel#PhaseA * channel#WaveLength)] + channel#Wave[0|(channel#PhaseB * channel#WaveLength)] * channel#ChorusSign) * channel#Volume * channel#Tremolo - channel#SampleRight) * channel#Filter * channel#VolumeRight; // CHIP \n\t\t\t\t\tchannel#SampleRight += (channel#Wave[0|(channel#Phase * 32768.0)] * channel#Volume - channel#SampleRight) * channel#Filter * channel#VolumeRight; // NOISE\n\t\t\t\t\tchannel#Volume += channel#VolumeDelta; // CHIP\n\t\t\t\t\tchannel#Volume += channel#VolumeDelta; // NOISE\n\t\t\t\t\tchannel#PhaseA += channel#PhaseDelta * channel#Vibrato; // CHIP\n\t\t\t\t\tchannel#PhaseB += channel#PhaseDelta * channel#Vibrato * channel#ChorusDeltaRatio; // CHIP\n\t\t\t\t\tchannel#Phase += channel#PhaseDelta; // NOISE\n\t\t\t\t\tchannel#Filter *= channel#FilterScale; // CHIP\n\t\t\t\t\tchannel#PhaseA -= 0|channel#PhaseA; // CHIP\n\t\t\t\t\tchannel#PhaseB -= 0|channel#PhaseB; // CHIP\n\t\t\t\t\tchannel#Phase -= 0|channel#Phase; // NOISE\n\t\t\t\t\tchannel#PhaseDelta *= channel#PhaseDeltaScale; // CHIP\n\t\t\t\t\tchannel#PhaseDelta *= channel#PhaseDeltaScale; // NOISE\n\t\t\t\t\t\n\t\t\t\t\t// INSERT OPERATOR COMPUTATION HERE\n\t\t\t\t\tchannel#SampleLeft = channel#Tremolo * (/*channel#Operator$Scaled*/) * channel#VolumeLeft; // CARRIER OUTPUTS\n\t\t\t\t\tchannel#SampleRight = channel#Tremolo * (/*channel#Operator$Scaled*/) * channel#VolumeRight; // CARRIER OUTPUTS\n\t\t\t\t\tchannel#FeedbackMult += channel#FeedbackDelta; // FM\n\t\t\t\t\tchannel#Operator$OutputMult += channel#Operator$OutputDelta; // FM\n\t\t\t\t\tchannel#Operator$Phase += channel#Operator$PhaseDelta * channel#Vibrato; // FM\n\t\t\t\t\tchannel#Operator$PhaseDelta *= channel#PhaseDeltaScale; // FM\n\t\t\t\t\t\n\t\t\t\t\t// Reverb, implemented using a feedback delay network with a Hadamard matrix and lowpass filters.\n\t\t\t\t\t// good ratios:    0.555235 + 0.618033 + 0.818 +   1.0 = 2.991268\n\t\t\t\t\t// Delay lengths:  3041     + 3385     + 4481  +  5477 = 16384 = 2^14\n\t\t\t\t\t// Buffer offsets: 3041    -> 6426   -> 10907 -> 16384\n\t\t\t\t\tvar delayPos1Left = (delayPosLeft +  3041) & 0x3FFF;\n\t\t\t\t\tvar delayPos2Left = (delayPosLeft +  6426) & 0x3FFF;\n\t\t\t\t\tvar delayPos3Left = (delayPosLeft + 10907) & 0x3FFF;\n\t\t\t\t\tvar delaySampleLeft0 = (delayLineLeft[delayPosLeft]\n\t\t\t\t\t\t+ channel#SampleLeft // PITCH\n\t\t\t\t\t);\n\t\t\t\t\tvar delayPos1Right = (delayPosRight +  3041) & 0x3FFF;\n\t\t\t\t\tvar delayPos2Right = (delayPosRight +  6426) & 0x3FFF;\n\t\t\t\t\tvar delayPos3Right = (delayPosRight + 10907) & 0x3FFF;\n\t\t\t\t\tvar delaySampleRight0 = (delayLineRight[delayPosRight]\n\t\t\t\t\t\t+ channel#SampleRight // PITCH\n\t\t\t\t\t);\n\t\t\t\t\tvar delaySampleLeft1 = delayLineLeft[delayPos1Left];\n\t\t\t\t\tvar delaySampleLeft2 = delayLineLeft[delayPos2Left];\n\t\t\t\t\tvar delaySampleLeft3 = delayLineLeft[delayPos3Left];\n\t\t\t\t\tvar delayTemp0Left = -delaySampleLeft0 + delaySampleLeft1;\n\t\t\t\t\tvar delayTemp1Left = -delaySampleLeft0 - delaySampleLeft1;\n\t\t\t\t\tvar delayTemp2Left = -delaySampleLeft2 + delaySampleLeft3;\n\t\t\t\t\tvar delayTemp3Left = -delaySampleLeft2 - delaySampleLeft3;\n\t\t\t\t\tdelayFeedback0Left += ((delayTemp0Left + delayTemp2Left) * reverb - delayFeedback0Left) * 0.5;\n\t\t\t\t\tdelayFeedback1Left += ((delayTemp1Left + delayTemp3Left) * reverb - delayFeedback1Left) * 0.5;\n\t\t\t\t\tdelayFeedback2Left += ((delayTemp0Left - delayTemp2Left) * reverb - delayFeedback2Left) * 0.5;\n\t\t\t\t\tdelayFeedback3Left += ((delayTemp1Left - delayTemp3Left) * reverb - delayFeedback3Left) * 0.5;\n\t\t\t\t\tdelayLineLeft[delayPos1Left] = delayFeedback0Left;\n\t\t\t\t\tdelayLineLeft[delayPos2Left] = delayFeedback1Left;\n\t\t\t\t\tdelayLineLeft[delayPos3Left] = delayFeedback2Left;\n\t\t\t\t\tdelayLineLeft[delayPosLeft ] = delayFeedback3Left;\n\t\t\t\t\tdelayPosLeft = (delayPosLeft + 1) & 0x3FFF;\n\t\t\t\t\t\n\t\t\t\t\tvar delaySampleRight1 = delayLineRight[delayPos1Right];\n\t\t\t\t\tvar delaySampleRight2 = delayLineRight[delayPos2Right];\n\t\t\t\t\tvar delaySampleRight3 = delayLineRight[delayPos3Right];\n\t\t\t\t\tvar delayTemp0Right = -delaySampleRight0 + delaySampleRight1;\n\t\t\t\t\tvar delayTemp1Right = -delaySampleRight0 - delaySampleRight1;\n\t\t\t\t\tvar delayTemp2Right = -delaySampleRight2 + delaySampleRight3;\n\t\t\t\t\tvar delayTemp3Right = -delaySampleRight2 - delaySampleRight3;\n\t\t\t\t\tdelayFeedback0Right += ((delayTemp0Right + delayTemp2Right) * reverb - delayFeedback0Right) * 0.5;\n\t\t\t\t\tdelayFeedback1Right += ((delayTemp1Right + delayTemp3Right) * reverb - delayFeedback1Right) * 0.5;\n\t\t\t\t\tdelayFeedback2Right += ((delayTemp0Right - delayTemp2Right) * reverb - delayFeedback2Right) * 0.5;\n\t\t\t\t\tdelayFeedback3Right += ((delayTemp1Right - delayTemp3Right) * reverb - delayFeedback3Right) * 0.5;\n\t\t\t\t\tdelayLineRight[delayPos1Right] = delayFeedback0Right;\n\t\t\t\t\tdelayLineRight[delayPos2Right] = delayFeedback1Right;\n\t\t\t\t\tdelayLineRight[delayPos3Right] = delayFeedback2Right;\n\t\t\t\t\tdelayLineRight[delayPosRight ] = delayFeedback3Right;\n\t\t\t\t\tdelayPosRight = (delayPosRight + 1) & 0x3FFF;\n\t\t\t\t\t\n\t\t\t\t\tvar sampleLeft = delaySampleLeft0 + delaySampleLeft1 + delaySampleLeft2 + delaySampleLeft3\n\t\t\t\t\t\t+ channel#SampleLeft // NOISE\n\t\t\t\t\t;\n\t\t\t\t\t\n\t\t\t\t\tvar sampleRight = delaySampleRight0 + delaySampleRight1 + delaySampleRight2 + delaySampleRight3\n\t\t\t\t\t\t+ channel#SampleRight // NOISE\n\t\t\t\t\t;\n\t\t\t\t\t\n\t\t\t\t\tvar abs = sampleLeft < 0.0 ? -sampleLeft : sampleLeft;\n\t\t\t\t\tlimit -= limitDecay;\n\t\t\t\t\tif (limit < abs) limit = abs;\n\t\t\t\t\tsampleLeft /= limit * 0.75 + 0.25;\n\t\t\t\t\tsampleLeft *= volume;\n\t\t\t\t\tsampleLeft = sampleLeft;\n\t\t\t\t\tdataLeft[bufferIndex] = sampleLeft;\n\t\t\t\t\tsampleRight /= limit * 0.75 + 0.25;\n\t\t\t\t\tsampleRight *= volume;\n\t\t\t\t\tsampleRight = sampleRight;\n\t\t\t\t\tdataRight[bufferIndex] = sampleRight;\n\t\t\t\t\tbufferIndex++;\n\t\t\t\t\tsamples--;\n\t\t\t\t}\n\t\t\t\t\n\t\t\t\tsynthChannel#.phases[0] = channel#PhaseA; // CHIP\n\t\t\t\tsynthChannel#.phases[1] = channel#PhaseB; // CHIP\n\t\t\t\tsynthChannel#.phases[0] = channel#Phase; // NOISE\n\t\t\t\tsynthChannel#.phases[$] = channel#Operator$Phase / " + Config.sineWaveLength + "; // FM\n\t\t\t\tsynthChannel#.feedbackOutputs[$] = channel#Operator$Output; // FM\n\t\t\t\tsynthChannel#.sampleLeft = channel#SampleLeft; // ALL\n\t\t\t\tsynthChannel#.sampleRight = channel#SampleRight; // ALL\n\t\t\t\t\n\t\t\t\tsynth.delayPosLeft = delayPosLeft;\n\t\t\t\tsynth.delayFeedback0Left = delayFeedback0Left;\n\t\t\t\tsynth.delayFeedback1Left = delayFeedback1Left;\n\t\t\t\tsynth.delayFeedback2Left = delayFeedback2Left;\n\t\t\t\tsynth.delayFeedback3Left = delayFeedback3Left;\n\t\t\t\tsynth.delayPosRight = delayPosRight;\n\t\t\t\tsynth.delayFeedback0Right = delayFeedback0Right;\n\t\t\t\tsynth.delayFeedback1Right = delayFeedback1Right;\n\t\t\t\tsynth.delayFeedback2Right = delayFeedback2Right;\n\t\t\t\tsynth.delayFeedback3Right = delayFeedback3Right;\n\t\t\t\tsynth.limit = limit;\n\t\t\t\t\n\t\t\t\tif (effectYMult * effectY - prevEffectY > prevEffectY) {\n\t\t\t\t\tsynth.effectPhase = Math.asin(effectY);\n\t\t\t\t} else {\n\t\t\t\t\tsynth.effectPhase = Math.PI - Math.asin(effectY);\n\t\t\t\t}\n\t\t\t\t\n\t\t\t\tif (synth.arpeggioSampleCountdown == 0) {\n\t\t\t\t\tsynth.arpeggio++;\n\t\t\t\t\tsynth.arpeggioSampleCountdown = samplesPerArpeggio;\n\t\t\t\t\tif (synth.arpeggio == 4) {\n\t\t\t\t\t\tsynth.arpeggio = 0;\n\t\t\t\t\t\tsynth.part++;\n\t\t\t\t\t\tif (synth.part == song.partsPerBeat) {\n\t\t\t\t\t\t\tsynth.part = 0;\n\t\t\t\t\t\t\tsynth.beat++;\n\t\t\t\t\t\t\tif (synth.beat == song.beatsPerBar) {\n\t\t\t\t\t\t\t\t// The bar ended, may need to regenerate synthesizer.\n\t\t\t\t\t\t\t\treturn bufferIndex;\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t\t\n\t\t\t// Indicate that the buffer is finished generating.\n\t\t\treturn -1;\n\t\t").split("\n");
	Synth.operatorSourceTemplate = ("\n\t\t\t\t\t\tvar channel#Operator$PhaseMix = channel#Operator$Phase/* + channel#Operator@Scaled*/;\n\t\t\t\t\t\tvar channel#Operator$PhaseInt = channel#Operator$PhaseMix|0;\n\t\t\t\t\t\tvar channel#Operator$Index    = channel#Operator$PhaseInt & " + Config.sineWaveMask + ";\n\t\t\t\t\t\tvar channel#Operator$Sample   = sineWave[channel#Operator$Index];\n\t\t\t\t\t\tchannel#Operator$Output       = channel#Operator$Sample + (sineWave[channel#Operator$Index + 1] - channel#Operator$Sample) * (channel#Operator$PhaseMix - channel#Operator$PhaseInt);\n\t\t\t\t\t\tvar channel#Operator$Scaled   = channel#Operator$OutputMult * channel#Operator$Output;\n\t\t").split("\n");
    beepbox.Synth = Synth;
	
})(beepbox || (beepbox = {}));
