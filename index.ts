import WordNet from "node-wordnet";
import { path as wordnetDbPath } from "wordnet-db";
import pos from "pos";
import { promisify } from "util";

// Promisify WordNet methods
const wordnet = new WordNet({ dataDir: wordnetDbPath });

// Root synset offsets
const ROOT_CATEGORIES: Record<number, string> = {
    1740: "Entity",
    50892: "Place",
    53998: "Part of the Body",
    26390: "Feeling"
};

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

async function categorizeWord(word: string): Promise<string[]> {
    const synsets = await wordnet.lookupAsync(word);
    const categories: Set<string> = new Set();

    for (const synset of synsets) {
        const found = await findCategoriesByHypernyms(synset.synsetOffset, synset.pos, new Set());
        for (const f of found) {
            categories.add(f);
        }
    }

    return Array.from(categories);
}

async function findCategoriesByHypernyms(
    offset: number,
    pos: string,
    visited: Set<string>
): Promise<string[]> {
    const key = `${offset}-${pos}`;
    if (visited.has(key)) {
        return [];
    }
    visited.add(key);

    const categories: string[] = [];

    if (ROOT_CATEGORIES[offset]) {
        categories.push(ROOT_CATEGORIES[offset]);
    }

    const synset = await wordnet.getAsync(offset, pos);
    if (!synset?.ptrs) {
        return categories;
    }

    for (const ptr of synset.ptrs) {
        if (ptr.pointerSymbol === "@") {
            const subcats = await findCategoriesByHypernyms(ptr.synsetOffset, ptr.pos, visited);
            categories.push(...subcats);
        }
    }

    return categories;
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

