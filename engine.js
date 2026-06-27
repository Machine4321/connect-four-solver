// Connect Four Bitboard Engine
// Board representation: 7 columns, 6 rows.
// We use a 49-bit BigInt for each player's bitboard.
// Each column is 7 bits (6 rows + 1 padding bit to prevent overflow).
// Col 0: bits 0-5 (padding 6)
// Col 1: bits 7-12 (padding 13)
// ...
// Col 6: bits 42-47 (padding 48)

const WIDTH = 7n;
const HEIGHT = 6n;
const H1 = HEIGHT + 1n; // 7n
const H2 = HEIGHT + 2n; // 8n
const SIZE = WIDTH * HEIGHT; // 42n

class Board {
    constructor() {
        this.position = 0n; // Current player's pieces
        this.mask = 0n;     // All pieces
        this.moves = 0;
    }

    clone() {
        let b = new Board();
        b.position = this.position;
        b.mask = this.mask;
        b.moves = this.moves;
        return b;
    }

    canPlay(col) {
        // Check if the top padding bit of this column in the mask is 0
        const topBit = 1n << (BigInt(col) * H1 + HEIGHT - 1n);
        return (this.mask & topBit) === 0n;
    }

    play(col) {
        // We find the lowest empty bit in the column by doing:
        // this.mask | bottom_mask
        // Actually, just standard bitboard move:
        // mask |= mask + bottom_mask_of_col
        // then we xor position
        
        // Wait, standard trick for dropping a piece:
        // bottom bit of column col: 1n << (col * 7n)
        // position ^= mask;
        // mask |= mask + bottom_mask;
        
        const bottomBit = 1n << (BigInt(col) * H1);
        this.position ^= this.mask;
        this.mask |= this.mask + bottomBit;
        this.moves++;
    }

    isWinningMove(col) {
        let pos = this.position;
        // hypothetically add piece to pos
        const bottomBit = 1n << (BigInt(col) * H1);
        const newMask = this.mask | (this.mask + bottomBit);
        const posWithMove = pos | (newMask ^ this.mask); // The piece we just placed
        
        return checkWin(posWithMove);
    }
}

function checkWin(pos) {
    // Horizontal
    let m = pos & (pos >> H1);
    if ((m & (m >> (2n * H1))) !== 0n) return true;
    
    // Diagonal 1
    m = pos & (pos >> HEIGHT);
    if ((m & (m >> (2n * HEIGHT))) !== 0n) return true;
    
    // Diagonal 2
    m = pos & (pos >> H2);
    if ((m & (m >> (2n * H2))) !== 0n) return true;
    
    // Vertical
    m = pos & (pos >> 1n);
    if ((m & (m >> 2n)) !== 0n) return true;
    
    return false;
}

// Transposition table
// We can use a simple JS Map for the transposition table. 
// Keys are the unique bitboard key: position + mask
function computeKey(board) {
    return board.position + board.mask;
}

// Move exploration order (center columns first)
const columnOrder = [3, 4, 2, 5, 1, 6, 0];

// Evaluation parameters
// We return score from the perspective of the CURRENT player to move.
// A win is a large score (e.g. 1000 - moves)
// A loss is a negative score (-1000 + moves)

let nodesExplored = 0;

function negamax(board, depth, alpha, beta) {
    nodesExplored++;
    
    // Check for draw
    if (board.moves === 42) return 0;
    
    // Check if we can win next move
    for (let col = 0; col < 7; col++) {
        if (board.canPlay(col) && board.isWinningMove(col)) {
            // We can win right now
            return 1000 - board.moves; // Faster wins are better
        }
    }
    
    if (depth === 0) {
        // Heuristic evaluation if max depth reached without terminal state
        // For simple connect four solver, we can just return 0 (draw/unknown) or a basic heuristic.
        // A better heuristic counts potential wins.
        return evaluateHeuristic(board);
    }
    
    let maxScore = -10000;
    
    for (let col of columnOrder) {
        if (board.canPlay(col)) {
            let nextBoard = board.clone();
            nextBoard.play(col);
            
            // Score from opponent's perspective, so negate it
            let score = -negamax(nextBoard, depth - 1, -beta, -alpha);
            
            if (score > maxScore) maxScore = score;
            if (alpha < score) alpha = score;
            if (alpha >= beta) break; // Alpha-beta pruning
        }
    }
    
    return maxScore;
}

function evaluateHeuristic(board) {
    // Simple heuristic: count pieces in the center column
    // The current player is the one WHOSE TURN IT IS.
    // board.position represents the CURRENT player's pieces BEFORE they make a move?
    // Wait, play() does: this.position ^= this.mask;
    // So board.position always stores the pieces of the player who is ABOUT TO MOVE.
    
    // Pieces of player about to move
    let myPieces = board.position;
    // Pieces of opponent
    let oppPieces = board.position ^ board.mask;
    
    let score = 0;
    // Center col is col 3. Bits 21 to 26
    const centerMask = 0b111111n << 21n;
    
    // Count set bits in center column
    let myCenter = myPieces & centerMask;
    let oppCenter = oppPieces & centerMask;
    
    // Popcount trick for BigInt isn't natively fast, but we can do a loop since it's just 6 bits
    let myCount = 0;
    let oppCount = 0;
    for(let i=21n; i<=26n; i++) {
        if (myCenter & (1n << i)) myCount++;
        if (oppCenter & (1n << i)) oppCount++;
    }
    
    score += myCount * 3;
    score -= oppCount * 3;
    
    return score;
}

function getBestMove(board, depth) {
    nodesExplored = 0;
    let bestMove = -1;
    let maxScore = -10000;
    let alpha = -10000;
    let beta = 10000;
    
    const t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    
    // Check if we can win immediately
    for (let col = 0; col < 7; col++) {
        if (board.canPlay(col) && board.isWinningMove(col)) {
            const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            return {
                move: col,
                score: 1000 - board.moves,
                nodes: 1,
                timeMs: Math.round(t1 - t0)
            };
        }
    }
    
    for (let col of columnOrder) {
        if (board.canPlay(col)) {
            let nextBoard = board.clone();
            nextBoard.play(col);
            let score = -negamax(nextBoard, depth - 1, -beta, -alpha);
            
            if (score > maxScore) {
                maxScore = score;
                bestMove = col;
            }
            if (alpha < score) alpha = score;
        }
    }
    
    const t1 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    
    // If no best move (e.g. losing in all variations), just pick the first valid
    if (bestMove === -1) {
        for (let col = 0; col < 7; col++) {
            if (board.canPlay(col)) {
                bestMove = col;
                break;
            }
        }
    }
    
    return {
        move: bestMove,
        score: maxScore,
        nodes: nodesExplored,
        timeMs: Math.round(t1 - t0)
    };
}

if (typeof module !== 'undefined') {
    module.exports = { Board, getBestMove, checkWin };
}
