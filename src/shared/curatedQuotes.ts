export type WisdomTradition =
  | 'Mahabharata'
  | 'Ramayana'
  | 'Gita & Upanishads'
  | 'Eastern Classics';

export interface CuratedWisdomQuote {
  id: string;
  quote: string;
  title: string;
  topic: string;
  description: string;
  hashtags: string[];
  visualQuery: string;
  visualStyle: string;
  category: string;
  tradition: WisdomTradition;
  inspirationNote: string;
  deeperMeaning: string;
}

export const CURATED_WISDOM_QUOTES: CuratedWisdomQuote[] = [
  {
    id: 'w-maha-1',
    quote:
      'Never explain yourself in anger; a calm mind sees the exit that rage tries to burn down.',
    title: 'Why Silence Beats Anger Every Time',
    topic: 'Emotional Restraint Under Pressure',
    description:
      'Anger feels powerful for ten seconds and costs you ten months of clarity. Step back before you speak.',
    hashtags: ['shorts', 'lifelessons', 'wisdom', 'mindset', 'psychology'],
    visualQuery: 'dark foggy mountain cliff solitude',
    visualStyle: 'Mountain Solitude',
    category: 'Timeless Wisdom',
    tradition: 'Mahabharata',
    inspirationNote: 'Mahabharata (Vidura Niti on composure & anger)',
    deeperMeaning:
      'Explains why reacting emotionally destroys your leverage while calm observation reveals hidden solutions.',
  },
  {
    id: 'w-maha-2',
    quote:
      'Stay careful who you borrow strength from, because every favor quietly buys a piece of your freedom.',
    title: 'The Hidden Price Of Easy Favors',
    topic: 'Self-Reliance & Quiet Independence',
    description:
      'What feels like free support today often becomes tomorrow’s obligation. Build your own ground first.',
    hashtags: ['shorts', 'wisdom', 'selfreliance', 'lifeadvice', 'mindset'],
    visualQuery: 'lone wolf dark silhouette ridge',
    visualStyle: 'Lone Wolf',
    category: 'Epic Strategy',
    tradition: 'Mahabharata',
    inspirationNote: 'Mahabharata (Karna’s debt of loyalty)',
    deeperMeaning:
      'Shows how unearned shortcuts trap you in loyalties that compromise your future judgment.',
  },
  {
    id: 'w-maha-3',
    quote:
      'What you chase out of fear controls you; what you master in patience eventually works for you.',
    title: 'Fear Rules What Patience Masters',
    topic: 'Patience Over Anxiety',
    description:
      'Rushing from insecurity puts others in charge of your choices. Slow mastery puts time on your side.',
    hashtags: ['shorts', 'patience', 'lifeadvice', 'mindset', 'philosophy'],
    visualQuery: 'dark ocean storm horizon minimal',
    visualStyle: 'Dark Ocean',
    category: 'Timeless Wisdom',
    tradition: 'Mahabharata',
    inspirationNote: 'Mahabharata (Yudhishthira on steadiness & endurance)',
    deeperMeaning:
      'Contrasts panic-driven decisions with patient discipline that turns time into an ally.',
  },
  {
    id: 'w-maha-4',
    quote:
      'Give full effort to the step in front of you; worrying about applause only splits your focus in half.',
    title: 'Why Obsessing Over Results Slows You Down',
    topic: 'Undivided Focus On Action',
    description:
      'Half your energy disappears the moment you start performing for approval instead of mastering the craft.',
    hashtags: ['shorts', 'focus', 'discipline', 'lifeadvice', 'wisdom'],
    visualQuery: 'black panther shadow dark studio',
    visualStyle: 'Black Panther',
    category: 'Discipline',
    tradition: 'Mahabharata',
    inspirationNote: 'Mahabharata (Detached action & archer’s focus)',
    deeperMeaning:
      'Explains practically why outcome-anxiety degrades performance while total presence sharpens it.',
  },
  {
    id: 'w-maha-5',
    quote:
      'Speak truth only when it builds or heals; blunt honesty without timing wounds more than a quiet lie.',
    title: 'Honesty Without Timing Still Hurts',
    topic: 'Wisdom In Speech & Timing',
    description:
      'Being right means very little if your delivery makes people close their ears. Measure your words.',
    hashtags: ['shorts', 'wisdom', 'communication', 'lifelessons', 'mindset'],
    visualQuery: 'foggy dark forest misty trees',
    visualStyle: 'Foggy Forest',
    category: 'Life Lessons',
    tradition: 'Mahabharata',
    inspirationNote: 'Mahabharata (Vidura on speech that uplifts)',
    deeperMeaning:
      'Teaches emotional intelligence—truth needs timing and care to actually help someone change.',
  },
  {
    id: 'w-rama-1',
    quote:
      'Never let a sudden loss decide your character; how you walk out matters more than what they took.',
    title: 'How You Handle Sudden Loss Defines You',
    topic: 'Dignity Through Setbacks',
    description:
      'Anyone looks noble when life goes their way. Real strength shows the morning everything changes.',
    hashtags: ['shorts', 'character', 'resilience', 'lifeadvice', 'wisdom'],
    visualQuery: 'dark rainy city street night noir',
    visualStyle: 'Rainy City',
    category: 'Mental Strength',
    tradition: 'Ramayana',
    inspirationNote: 'Ramayana (Composure when plans collapse overnight)',
    deeperMeaning:
      'Shows that external status can vanish instantly, but steady dignity keeps you unbroken.',
  },
  {
    id: 'w-rama-2',
    quote:
      'When you silence everyone who corrects you, your own pride finishes the job your enemies started.',
    title: 'Why Pride Destroys Smarter People',
    topic: 'Danger Of Refusing Honest Counsel',
    description:
      'Surrounding yourself with people who only nod feels comforting—until nobody warns you before the cliff.',
    hashtags: ['shorts', 'ego', 'wisdom', 'psychology', 'lifeadvice'],
    visualQuery: 'dark eagle mountain peak shadow',
    visualStyle: 'Powerful Eagle',
    category: 'Epic Strategy',
    tradition: 'Ramayana',
    inspirationNote: 'Ramayana (Ravana rejecting Vibhishana’s warning)',
    deeperMeaning:
      'Explains why ego-driven echo chambers collapse from the inside before rivals even strike.',
  },
  {
    id: 'w-rama-3',
    quote:
      'One bitter voice in your ear can ruin a peaceful house if you lack the courage to verify.',
    title: 'Guard Your Mind From Borrowed Poison',
    topic: 'Protecting Peace From Manipulation',
    description:
      'People rarely ruin your life directly; they plant one doubt and let your own insecurity do the rest.',
    hashtags: ['shorts', 'psychology', 'peace', 'lifeadvice', 'mindset'],
    visualQuery: 'dark minimal architecture shadow light',
    visualStyle: 'Philosophical Minimalism',
    category: 'Psychology',
    tradition: 'Ramayana',
    inspirationNote: 'Ramayana (Manthara’s whisper & unverified doubt)',
    deeperMeaning:
      'Reveals how second-hand bitterness destroys long-built trust when left unquestioned.',
  },
  {
    id: 'w-rama-4',
    quote:
      'Most limits only exist until you step forward; you rarely discover your strength while standing safe on shore.',
    title: 'You Only Meet Your Strength Mid-Leap',
    topic: 'Overcoming Self-Doubt Through Action',
    description:
      'Waiting to feel ready keeps you small. Clarity and capability show up after the first committed move.',
    hashtags: ['shorts', 'courage', 'motivation', 'lifeadvice', 'growth'],
    visualQuery: 'dark cliff ocean waves moody',
    visualStyle: 'Dark Ocean',
    category: 'Motivation',
    tradition: 'Ramayana',
    inspirationNote: 'Ramayana (Hanuman remembering dormant strength before the leap)',
    deeperMeaning:
      'Explains why confidence follows action rather than preceding it.',
  },
  {
    id: 'w-rama-5',
    quote:
      'Refuse anything gained through someone else’s unfair loss; stolen comfort never lets your mind rest.',
    title: 'Why Unfair Wins Never Feel Good',
    topic: 'Clean Conscience Over Shortcuts',
    description:
      'A win you have to hide or justify every day costs more peace than starting over honestly.',
    hashtags: ['shorts', 'integrity', 'lifelessons', 'wisdom', 'mindset'],
    visualQuery: 'dark horse mist monochrome',
    visualStyle: 'Cinematic Horse',
    category: 'Life Lessons',
    tradition: 'Ramayana',
    inspirationNote: 'Ramayana (Bharata refusing an unearned throne)',
    deeperMeaning:
      'Shows why self-respect outlasts status gained at another person’s expense.',
  },
  {
    id: 'w-gita-1',
    quote:
      'An untrained mind magnifies small setbacks into storms; quiet discipline shrinks them back to their true size.',
    title: 'Your Mind Decides The Size Of The Problem',
    topic: 'Mental Training & Perspective',
    description:
      'Most suffering happens in rehearsal, not reality. Train your reactions before chaos tests them.',
    hashtags: ['shorts', 'mentalstrength', 'discipline', 'mindset', 'wisdom'],
    visualQuery: 'dark mountain peak fog monochrome',
    visualStyle: 'Mountain Solitude',
    category: 'Mental Strength',
    tradition: 'Gita & Upanishads',
    inspirationNote: 'Bhagavad Gita (Mind as friend vs enemy)',
    deeperMeaning:
      'Explains how unexamined thoughts exaggerate pain, while self-regulation restores proportion.',
  },
  {
    id: 'w-gita-2',
    quote:
      'Walking your own rough path teaches you strength; copying someone else’s easy road leaves you hollow inside.',
    title: 'Stop Living Someone Else’s Script',
    topic: 'Authenticity Over Comparison',
    description:
      'An imperfect life you chose teaches you resilience. A borrowed life only teaches you how to pretend.',
    hashtags: ['shorts', 'selfgrowth', 'lifeadvice', 'philosophy', 'mindset'],
    visualQuery: 'lone wolf foggy pine forest',
    visualStyle: 'Lone Wolf',
    category: 'Philosophy',
    tradition: 'Gita & Upanishads',
    inspirationNote: 'Bhagavad Gita (Own path vs imitated path)',
    deeperMeaning:
      'Explains why struggle on an authentic path builds real fulfillment while imitation breeds emptiness.',
  },
  {
    id: 'w-gita-3',
    quote:
      'Chasing more never brings peace, because an ungrateful mind turns every new achievement into the next hunger.',
    title: 'Why Reaching Goals Still Feels Empty',
    topic: 'Contentment & Endless Desire',
    description:
      'If peace depends on the next milestone, the goalpost will keep moving one step ahead of you forever.',
    hashtags: ['shorts', 'peace', 'lifeadvice', 'psychology', 'wisdom'],
    visualQuery: 'dark minimal shadow monochrome',
    visualStyle: 'Philosophical Minimalism',
    category: 'Psychology',
    tradition: 'Gita & Upanishads',
    inspirationNote: 'Bhagavad Gita (Desire as an unfillable fire)',
    deeperMeaning:
      'Explains the hedonic treadmill clearly: inner steadiness must be practiced, not purchased.',
  },
  {
    id: 'w-gita-4',
    quote:
      'Every choice trades tomorrow for today; easy comfort steals your future while hard honesty quietly builds it.',
    title: 'The Quiet Trade Behind Every Habit',
    topic: 'Long-Term Wisdom Over Short Comfort',
    description:
      'What feels good right now often charges interest later. Choose what makes next year lighter.',
    hashtags: ['shorts', 'discipline', 'habits', 'lifeadvice', 'success'],
    visualQuery: 'dark cinematic night stairs shadow',
    visualStyle: 'Dark Cinematic Motivation',
    category: 'Discipline',
    tradition: 'Gita & Upanishads',
    inspirationNote: 'Katha Upanishad (The pleasant vs the truly good)',
    deeperMeaning:
      'Distills the classic choice between immediate gratification and lasting growth into clear daily advice.',
  },
  {
    id: 'w-gita-5',
    quote:
      'You cannot see clearly in water you keep stirring; slow down first, and the right answer settles naturally.',
    title: 'Why Overthinking Hides The Obvious Answer',
    topic: 'Clarity Through Stillness',
    description:
      'Panic keeps muddying the picture. Step away from the noise for an hour and watch confusion drop.',
    hashtags: ['shorts', 'clarity', 'overthinking', 'wisdom', 'lifeadvice'],
    visualQuery: 'dark still water reflection night',
    visualStyle: 'Dark Ocean',
    category: 'Timeless Wisdom',
    tradition: 'Gita & Upanishads',
    inspirationNote: 'Upanishadic stillness & clarity metaphor',
    deeperMeaning:
      'Shows why frantic analysis obscures truth and stillness lets perspective settle.',
  },
  {
    id: 'w-east-1',
    quote:
      'Guard your private thoughts more closely than your reputation, because repeated thoughts silently become your habits.',
    title: 'Your Private Thoughts Write Your Future',
    topic: 'Inner Habits Shape Outer Life',
    description:
      'Nobody sees what you rehearse alone at night—until it shows up in every decision you make.',
    hashtags: ['shorts', 'mindset', 'habits', 'lifeadvice', 'psychology'],
    visualQuery: 'dark wildlife shadow silhouette',
    visualStyle: 'Dark Wildlife',
    category: 'Psychology',
    tradition: 'Eastern Classics',
    inspirationNote: 'Dhammapada (Mind precedes all actions)',
    deeperMeaning:
      'Explains how small, unguarded mental patterns quietly compound into destiny.',
  },
  {
    id: 'w-east-2',
    quote:
      'Holding onto resentment is drinking poison while waiting for someone else to suffer; drop it to breathe again.',
    title: 'Who Really Pays For Your Resentment',
    topic: 'Letting Go For Your Own Peace',
    description:
      'They moved on weeks ago. Carrying the weight only guarantees you lose tomorrow too.',
    hashtags: ['shorts', 'peace', 'lettinggo', 'lifelessons', 'wisdom'],
    visualQuery: 'dark rainy window night silhouette',
    visualStyle: 'Rainy City',
    category: 'Life Lessons',
    tradition: 'Eastern Classics',
    inspirationNote: 'Eastern contemplative wisdom on anger & release',
    deeperMeaning:
      'Reframes forgiveness not as excusing someone else, but as freeing your own oxygen.',
  },
  {
    id: 'w-east-3',
    quote:
      'Water wears down stone without fighting it; steady consistency always outlasts loud, impatient force.',
    title: 'Why Quiet Consistency Beats Intense Bursts',
    topic: 'Power Of Gentle Persistence',
    description:
      'Exhausting yourself in one dramatic week proves nothing. Showing up calmly for a year changes everything.',
    hashtags: ['shorts', 'consistency', 'discipline', 'wisdom', 'success'],
    visualQuery: 'dark waterfall misty forest rocks',
    visualStyle: 'Foggy Forest',
    category: 'Success',
    tradition: 'Eastern Classics',
    inspirationNote: 'Tao Te Ching (Water overcoming stone)',
    deeperMeaning:
      'Explains why sustainable patience breaks obstacles that brute force only bounces off.',
  },
  {
    id: 'w-east-4',
    quote:
      'Who knows when to stop rarely falls; endless ambition blinds you right before the ground disappears.',
    title: 'Knowing When Enough Is Enough',
    topic: 'Restraint At The Peak',
    description:
      'Most people do not lose because they had too little—they lose because they risked everything for a little more.',
    hashtags: ['shorts', 'ambition', 'wisdom', 'lifeadvice', 'philosophy'],
    visualQuery: 'dark mountain summit fog night',
    visualStyle: 'Mountain Solitude',
    category: 'Epic Strategy',
    tradition: 'Eastern Classics',
    inspirationNote: 'Tao Te Ching (Knowing contentment & limits)',
    deeperMeaning:
      'Teaches strategic restraint so ambition does not blind you to risk.',
  },
  {
    id: 'w-east-5',
    quote:
      'Luck is often the name people give to quiet preparation they never saw you doing alone.',
    title: 'What People Call Luck',
    topic: 'Effort Over Fatalism',
    description:
      'Calling someone lucky makes it easier to excuse inaction. Build your craft when nobody is clapping.',
    hashtags: ['shorts', 'discipline', 'selfmade', 'lifeadvice', 'motivation'],
    visualQuery: 'dark horse night silhouette dust',
    visualStyle: 'Cinematic Horse',
    category: 'Discipline',
    tradition: 'Eastern Classics',
    inspirationNote: 'Yoga Vasistha (Self-effort over passive fate)',
    deeperMeaning:
      'Reframes fate vs effort into a grounded truth about unseen daily preparation.',
  },
];
