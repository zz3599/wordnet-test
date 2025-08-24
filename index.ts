import WordNet from "node-wordnet";
import { path as wordnetDbPath } from "wordnet-db";
import pos from "pos";
import * as fs from "fs";
import * as path from "path";

// Promisify WordNet methods
const wordnet = new WordNet({ dataDir: wordnetDbPath });

export const NOUN_LEX_NAME_MAP: Record<number, string> = {
    3: "noun.Tops",
    4: "noun.act",
    5: "noun.animal",
    6: "noun.artifact",
    7: "noun.attribute",
    8: "noun.body",
    9: "noun.cognition",
    10: "noun.communication",
    11: "noun.event",
    12: "noun.feeling",
    13: "noun.food",
    14: "noun.group",
    15: "noun.location",
    16: "noun.motive",
    17: "noun.object",
    18: "noun.person",
    19: "noun.phenomenon",
    20: "noun.plant",
    21: "noun.possession",
    22: "noun.process",
    23: "noun.quantity",
    24: "noun.relation",
    25: "noun.shape",
    26: "noun.state",
    27: "noun.substance",
    28: "noun.time",
};


async function categorizeNoun(word: string): Promise<string[]> {
    const synsets = await wordnet.lookupAsync(word);

    const categories: string[] = [];

    for (const synset of synsets) {
        const lexName = synset.lexName || NOUN_LEX_NAME_MAP[synset.lexFilenum ?? 3];
        if (!lexName) continue;
        categories.push(lexName);
    }

    return [...new Set(categories)]; // deduplicate
}


// POS tagging and test
const lexer = new pos.Lexer();
const tagger = new pos.Tagger();

(async () => {
    const words = ['Paris', 'happy', 'finger', 'foot', 'thumb', 'China', 'India', 'plumber', 'engineer', 'official', 'cowboy'];

    const results = await Promise.all(words.map(async (word) => {
        const lex = lexer.lex(word);
        const [[_, tag]] = tagger.tag(lex);
        let categories = null;
        if (tag.startsWith("NN")) {
            categories = await categorizeNoun(word);
            console.log(`${word} = ${tag}, ${categories}`)
        }
        return { word, posTag: tag };
    })).catch((e) => {
        // console.error("=== Raw e ===");
        // console.log(e);
        // console.log("Type:", typeof e, "Constructor:", e?.constructor?.name);
        // console.log("String:", String(e));
    });

    console.log(results);
})();

// Lexname list from WordNet 3.1 (45 categories)
const lexnames = [
    "adj.all", "adj.pert", "adv.all",
    "noun.Tops", "noun.act", "noun.animal", "noun.artifact", "noun.attribute",
    "noun.body", "noun.cognition", "noun.communication", "noun.event",
    "noun.feeling", "noun.food", "noun.group", "noun.location", "noun.motive",
    "noun.object", "noun.person", "noun.phenomenon", "noun.plant",
    "noun.possession", "noun.process", "noun.quantity", "noun.relation",
    "noun.shape", "noun.state", "noun.substance", "noun.time",
    "verb.body", "verb.change", "verb.cognition", "verb.communication",
    "verb.competition", "verb.consumption", "verb.contact", "verb.creation",
    "verb.emotion", "verb.motion", "verb.perception", "verb.possession",
    "verb.social", "verb.stative", "verb.weather"
];

function getLexnameByIndex(i: number): string {
    return lexnames[i] ?? `UNKNOWN(${i})`;
}

async function main() {
    const outputPath = path.join(__dirname, "wordnet_words.txt");
    const writeStream = fs.createWriteStream(outputPath, { flags: "w" });

    const parts = [
        { index: "index.noun", data: "data.noun" },
        { index: "index.verb", data: "data.verb" },
        { index: "index.adj", data: "data.adj" },
        { index: "index.adv", data: "data.adv" },
    ];

    const seen = new Set<string>();

    for (const { index, data } of parts) {
        const indexPath = path.join(wordnetDbPath, index);
        const dataPath = path.join(wordnetDbPath, data);

        // Load data.* into memory (map synset offset -> lexname index)
        const offsetToLex: Record<string, string> = {};
        const dataLines = fs.readFileSync(dataPath, "utf-8").split("\n");
        for (const line of dataLines) {
            if (!line || line.startsWith("  ")) continue;
            const parts = line.trim().split(" ");
            const offset = parts[0];
            const lexIdx = parseInt(parts[1], 10); // lexname index
            offsetToLex[offset] = getLexnameByIndex(lexIdx);
        }

        // Now parse index.* to get words + synset offsets
        const indexLines = fs.readFileSync(indexPath, "utf-8").split("\n");
        for (const line of indexLines) {
            if (!line || line.startsWith("  ")) continue;

            const bits = line.trim().split(/\s+/);
            const word = bits[0]; // lemma (with underscores if multiword)
            if (seen.has(word)) continue;
            seen.add(word);

            const synsetCnt = parseInt(bits[2], 10);
            const offsets = bits.slice(bits.length - synsetCnt);

            const wordLex = Array.from(
                new Set(offsets.map((o) => offsetToLex[o]).filter(Boolean))
            );

            writeStream.write(`${word},${wordLex.join(",")}\n`);
        }
    }

    writeStream.end();
    console.log("Done! Output at:", outputPath);
}

main().catch(console.error);
