declare module "pos" {
    export class Lexer {
        lex(input: string): string[];
    }

    export class Tagger {
        tag(words: string[]): [string, string][];
    }
}
