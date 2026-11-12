// The story: Jun is secretly feeding a stray cat and her newborn kittens under the house, and thinks the only way
// to pay for milk is to kupit. The family notices things going missing and grows suspicious, and in the storm he
// is finally CAUGHT, red-handed, with a shirt full of kittens. Only then do they see what the coins were for, and
// nobody scolds him: all he ever had to do was ask.
//
// Panels: { who (portrait), lines } - mixed case, drawn in the 5x8 dialogue font, max 37 characters per line and
// 4 lines per panel (tests/story.test.mjs checks both, and that every character has a glyph).
// join: a sibling who joins the crew on this panel. flag: a story flag set when the scene has played.
// mood: the portrait's expression (happy | sad | angry | shock; default neutral).
// caught: the panel opens like the game's own "caught" screen (red frame, HULI KA!, the caught sting).

export const INTRO = [
  { who: 'jun', lines: ['Under our house, behind the old', 'boxes, I found a cat.'] },
  { who: 'cat', lines: ['Mrrow.'] },
  { who: 'jun', lines: ['Mingming. And three kittens, so', "new their eyes aren't open yet."] },
  { who: 'jun', lines: ['She is so thin. She needs milk.', 'Milk costs money. I have none.'] },
  { who: 'mama', mood: 'angry', lines: ['Jun! No more animals in this', 'house, ha? We talked about this.'] },
  { who: 'jun', mood: 'sad', lines: ["...So it's a secret.", 'Just a few coins. Nobody will know.'] },
];

// Shown once, before the level with that id starts.
export const BEFORE = {
  'boss1-lola': [
    { who: 'jun', lines: ['The milk is gone already.', 'Kittens drink a LOT.'] },
    { who: 'jun', lines: ["Lola's bayong is by her chair.", 'She naps all afternoon...'] },
  ],
  '04-bakuran': [
    { who: 'bing', lines: ['Kuya Jun? Why do you keep going', 'under the house?'] },
    { who: 'jun', lines: ['Bing! Shh! ...Okay. Come look.', "But you can't tell anyone."] },
    { who: 'bing', lines: ['KITTENS! I can help! I am small.', 'Nobody ever sees me.'], join: 'bing' },
  ],
  gatas: [
    { who: 'jun', lines: ['Mingming will not leave her', 'babies, not even to drink.'] },
    { who: 'bing', lines: ["There's fresh milk in the kitchen.", 'Carry it slowly. Do not run!'] },
  ],
  'boss2-mama': [
    { who: 'jun', lines: ['Mingming eats for four now.', 'The coins never last.'] },
    { who: 'mama', mood: 'angry', lines: ['Who has been in my purse?', 'I count it, you know!'] },
    { who: 'jun', mood: 'shock', lines: ['...She counts it.', 'Mama is cooking. Careful now.'] },
  ],
  '05-gabi': [
    { who: 'ramil', mood: 'angry', lines: ["HULI KA! I saw you at Mama's", 'purse. I am telling!'] },
    { who: 'jun', mood: 'shock', lines: ['Kuya, wait! Please. Just come', 'and see why. Please.'] },
    { who: 'ramil', mood: 'happy', lines: ['...They are so small.', 'Fine. I saw nothing. Move over.'], join: 'ramil' },
  ],
  ibalik: [
    { who: 'mama', mood: 'sad', lines: ['That is odd. I am short for the', 'palengke. I was sure I had it...'] },
    { who: 'jun', mood: 'sad', lines: ['Mama skipped her merienda today.', 'Because of me.'] },
    { who: 'jun', lines: ['I took too much. Tonight I put', 'it back. Every coin.'] },
  ],
  'boss3-tatay': [
    { who: 'tatay', mood: 'angry', lines: ['Who keeps taking my fried fish?', 'And the coins from my wallet?'] },
    { who: 'ramil', mood: 'shock', lines: ['Jun... he is starting to notice.', 'Tatay is setting the dog loose.'] },
    { who: 'jun', lines: ['Then we have to be quieter.', 'Mingming needs that fish.'] },
  ],
  '08-palengke': [
    { who: 'nena', lines: ['Sardines again, ijo? And milk?', 'Every week. For a school project?'] },
    { who: 'nene', lines: ['It is for Mingming! She has', 'babies! ...Oops.'] },
    { who: 'nena', mood: 'happy', lines: ["Ay, a mama cat! Why didn't you", 'say so? For her, I give a discount.'], join: 'nene', flag: 'nena' },
  ],
  'boss4-fiesta': [
    { who: 'nene', lines: ['I named them! Puti, Muning,', 'and Tigre. Tigre bites.'] },
    { who: 'jun', lines: ['They need a vet soon. Ninang', 'always brings fat envelopes...'] },
  ],
  bagyo: [
    { who: 'jun', lines: ['Signal number three. The yard', 'is already filling with water.'] },
    { who: 'jun', mood: 'shock', lines: ['The kittens are still under the', 'house. I have to get them out.'] },
    { who: 'mama', mood: 'angry', lines: ['Jun? JUN! Where is that boy?', 'In THIS weather?!'] },
    { who: 'jun', lines: ['If they catch me now, they will', 'know everything. Run when the', 'thunder rolls. Nobody hears then.'] },
  ],
};

// The moment the storm level is cleared: Jun runs in through the door with the kittens and is caught at last.
// They are ready to scold him, until they see what he is carrying and understand where every coin went.
export const ENDING = [
  { who: 'mama', mood: 'angry', caught: true, lines: ['JUN!! So it WAS you. Every coin', 'from my purse. All this time!'] },
  { who: 'tatay', mood: 'angry', lines: ['My wallet. My fish. And now out', 'in a typhoon! Explain yourself!'] },
  { who: 'jun', mood: 'sad', lines: ["I'm sorry! I'm sorry! I only..."] },
  { who: 'cat', lines: ['Mew.   Mew.   Mew.'] },
  { who: 'mama', mood: 'shock', lines: ['...Jun. What is in your shirt?'] },
  { who: 'jun', mood: 'sad', lines: ['Kittens. Three. And their mama.', 'They live under our house.'] },
  { who: 'jun', mood: 'sad', lines: ['The coins were for their milk.', 'The fish was for Mingming.', 'She was so thin, Ma.'] },
  { who: 'lola', mood: 'shock', lines: ['Ay, apo. All of that kupit...', 'was for them?'] },
  { who: 'tatay', lines: ['...So that is where my fish went.', 'Hm. She can have the next one too.'] },
  { who: 'mama', mood: 'sad', lines: ['I was ready to be so angry.', 'Come here. You are soaking wet.'] },
  { who: 'jun', mood: 'shock', lines: ["You're... not mad?"] },
  { who: 'mama', lines: ['I said no more animals. I never', 'said to let them go hungry.'] },
  { who: 'mama', mood: 'happy', lines: ['Anak, you never have to kupit.', 'Magsabi ka lang. Just ask.'] },
  { who: 'lola', mood: 'happy', lines: ['Now bring Mingming inside.', 'She is family. Dry them off!'] },
];

// After the epilogue level (HINGI): the last word.
export const EPILOGUE = [
  { who: 'cat', lines: ['Purrrrrr.'] },
  { who: 'jun', mood: 'happy', lines: ['Mingming sleeps on the sofa now.', 'Tigre still bites.'] },
  { who: 'nena', mood: 'happy', lines: ['And you still owe me for two', 'cans of sardines. Joke lang!'] },
  { who: 'jun', lines: ['Getting caught was the best', 'thing that ever happened to me.'] },
  { who: 'jun', mood: 'happy', lines: ['I never had to kupit.', 'I only had to ask.'] },
  { who: 'jun', mood: 'happy', lines: ['Salamat sa paglalaro!'] },
];

export const NAMES = { jun: 'Jun', bing: 'Bing', ramil: 'Kuya Ramil', nene: 'Nene', mama: 'Mama', lola: 'Lola', tatay: 'Tatay', nena: 'Aling Nena', cat: 'Mingming' };

// The five chapters of the campaign, by the id of their first level (the map screen groups levels under these).
export const CHAPTERS = [
  { name: 'ANG SIKRETO', sub: 'THE SECRET', from: '01-sala' },
  { name: 'GATAS', sub: 'MILK', from: '04-bakuran' },
  { name: 'KASABWAT', sub: 'PARTNERS IN CRIME', from: '05-gabi' },
  { name: 'SA LABAS', sub: 'OUT IN THE BARANGAY', from: '08-palengke' },
  { name: 'BAGYO', sub: 'THE STORM', from: 'bagyo' },
];
