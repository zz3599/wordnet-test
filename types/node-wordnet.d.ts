declare module "node-wordnet" {
    export interface Pointer {
        pointerSymbol: string;  // e.g., '@' for hypernym
        synsetOffset: number;   // offset of the target synset
        pos: string; // noun, verb, adj, adv, adj satellite
        sourceTarget: string;   // typically '0000'
    }

    export interface LookupResult {
        synsetOffset: number;   // offset ID of the synset
        // Based on https://wordnet.princeton.edu/documentation/lexnames5wn
        lexFilenum: number;     // lexicographer file number (0..25)
        lexNo?: number;         // alias for lexFilenum
        lexName?: string;       // e.g., 'noun.person', may be added by WordNet library
        pos: string;
        lemma: string;          // canonical form of the word
        synonyms: string[];     // all words in the synset
        gloss: string;          // definition + example
        ptrs: Pointer[];        // pointers to related synsets
        def?: string;           // optional shorthand for definition
    }

    export default class WordNet {
        constructor(options?: { dataDir?: string });

        // Lookup by word
        lookup(word: string, callback: (err: Error | null, results: LookupResult[]) => void): void;
        lookupAsync(word: string): Promise<LookupResult[]>;

        // Lookup by synset offset and pos
        get(offset: number, pos: string, callback: (err: Error | null, result: LookupResult) => void): void;
        getAsync(offset: number, pos: string): Promise<LookupResult>;

        // Optional: add convenience function for lexName mapping
        static lexName(lexFilenum: number): string;
    }
}
