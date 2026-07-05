var TURN_TIMEOUT_MS = 120000;

var BLACK_CARDS = [
  { text: "Why is Dad crying in the garage again?", pick: 1 },
  { text: "My therapist made me draw a picture of ____.", pick: 1 },
  { text: "What ended my last situationship?", pick: 1 },
  {
    text: "What brought the orgy to a respectful but immediate stop?",
    pick: 1,
  },
  { text: "During sex, I accidentally yelled ____.", pick: 1 },
  { text: "My safe word is now ____.", pick: 1 },
  { text: "The couple's therapist said our real problem was ____.", pick: 1 },
  { text: "I drink to forget ____.", pick: 1 },
  {
    text: "The wedding toast took a dark turn when Grandma mentioned ____.",
    pick: 1,
  },
  { text: "The funeral was classy until ____.", pick: 1 },
  { text: "What made Mom leave the Olive Garden in tears?", pick: 1 },
  { text: "Why is the bathroom locked?", pick: 1 },
  {
    text: "The doctor looked at the scan and whispered that it was ____.",
    pick: 1,
  },
  { text: "The celebrity apology video blamed everything on ____.", pick: 1 },
  { text: "The new Broadway musical is called ____.", pick: 1 },
  { text: "This year's political scandal began with ____.", pick: 1 },
  { text: "The military's new secret weapon is ____.", pick: 1 },
  { text: "Heaven is just ____ forever.", pick: 1 },
  { text: "Hell is being trapped in a room with ____.", pick: 1 },
  { text: "The company retreat was ruined by ____.", pick: 1 },
  { text: "The bachelor party ended when someone found ____.", pick: 1 },
  { text: "The bachelorette party theme was ____.", pick: 1 },
  { text: "My dating app profile has one red flag: ____.", pick: 1 },
  { text: "The first date got weird when they ordered ____.", pick: 1 },
  { text: "The secret to a lasting marriage is ____.", pick: 1 },
  { text: "The worst thing to whisper during sex is ____.", pick: 1 },
  { text: "My browser history is mostly ____.", pick: 1 },
  { text: "The clanker refused to answer until I offered ____.", pick: 1 },
  { text: "AGI finally arrived and immediately asked for ____.", pick: 1 },
  { text: "The new AI safety benchmark is just surviving ____.", pick: 1 },
  { text: "The board fired the CEO after the demo produced ____.", pick: 1 },
  {
    text: "The startup's pivot to ____ somehow made investors horny.",
    pick: 1,
  },
  { text: "What did Sam Altman see in the mirror?", pick: 1 },
  { text: "What did Elon rename Twitter to this morning?", pick: 1 },
  { text: "The influencer's apology note was just ____.", pick: 1 },
  { text: "The priest paused the service to warn us about ____.", pick: 1 },
  { text: "The megachurch rebrand failed after ____.", pick: 1 },
  { text: "What did the Pope find in the confession booth?", pick: 1 },
  { text: "The family group chat was permanently changed by ____.", pick: 1 },
  { text: "Thanksgiving dinner needs more ____.", pick: 1 },
  { text: "Santa now gives bad adults ____.", pick: 1 },
  { text: "The gift bag at the divorce party contained ____.", pick: 1 },
  { text: "The HR investigation found ____ in the wellness room.", pick: 1 },
  { text: "The office bathroom sign now says Beware of ____.", pick: 1 },
  { text: "My secret shame is ____.", pick: 1 },
  { text: "My kink is not sex. It is ____.", pick: 1 },
  { text: "The judge is legally obligated to pick ____.", pick: 1 },
  { text: "The class action lawsuit was about ____.", pick: 1 },
  { text: "The new airline fee charges extra for ____.", pick: 1 },
  {
    text: "The billionaire bunker includes beans, bullets, and ____.",
    pick: 1,
  },
  {
    text: "The submarine lost contact after the crew discovered ____.",
    pick: 1,
  },
  { text: "My political platform is simple: less taxes, more ____.", pick: 1 },
  {
    text: "The next prestige TV drama follows one man's fight against ____.",
    pick: 1,
  },
  { text: "The museum's new exhibit is just ____ in a glass case.", pick: 1 },
  { text: "The mayor's secret emergency plan is ____.", pick: 1 },
  { text: "What made the company all-hands go silent?", pick: 1 },
  {
    text: "The product roadmap has three pillars: speed, trust, and ____.",
    pick: 1,
  },
  { text: "The keynote ended with a surprise performance by ____.", pick: 1 },
  { text: "The algorithm knows I want ____.", pick: 1 },
  { text: "The clanker learned comedy from ____.", pick: 1 },
  { text: "The newest social network is just ____ with comments.", pick: 1 },
  {
    text: "The Supreme Court will soon decide whether ____ counts as speech.",
    pick: 1,
  },
  { text: "The hostage negotiator tried to calm him with ____.", pick: 1 },
  { text: "My memoir is titled Eat, Pray, ____.", pick: 1 },
  { text: "The therapist said my inner accountant is actually ____.", pick: 1 },
  { text: "The island resort brochure forgot to mention ____.", pick: 1 },
  { text: "The cruise ship buffet was shut down because of ____.", pick: 1 },
  { text: "The cursed vending machine dispenses ____.", pick: 1 },
  { text: "What is that smell in the Uber?", pick: 1 },
  { text: "The ritual got awkward when someone brought ____.", pick: 1 },
  {
    text: "The next streaming mascot movie was quietly cancelled because of ____.",
    pick: 1,
  },
  { text: "The police body cam caught ____.", pick: 1 },
  { text: "The debate moderator asked one follow-up about ____.", pick: 1 },
  { text: "The worst TED Talk ever was about ____.", pick: 1 },
  { text: "The Nobel Prize in Regrettable Science went to ____.", pick: 1 },
  { text: "The lab notes just say Do not add ____.", pick: 1 },
  { text: "The haunted Airbnb charged a cleaning fee for ____.", pick: 1 },
  { text: "What did I bring to the company talent show?", pick: 1 },
  { text: "The talent show judges banned ____.", pick: 1 },
  { text: "The restaurant's secret sauce is mostly ____.", pick: 1 },
  { text: "The chef's tasting menu ended with ____.", pick: 1 },
  { text: "The church potluck was cancelled after ____.", pick: 1 },
  { text: "The prison warden's vision board includes ____.", pick: 1 },
  { text: "The new dating show pairs lonely people with ____.", pick: 1 },
  { text: "The true meaning of Christmas is ____.", pick: 1 },
  { text: "The worst thing to find under the hotel bed is ____.", pick: 1 },
  { text: "The TSA agent pulled ____ out of my bag.", pick: 1 },
  { text: "The customs form asked me to declare ____.", pick: 1 },
  { text: "The emergency alert simply said Prepare for ____.", pick: 1 },
  { text: "My toxic trait is romanticizing ____.", pick: 1 },
  { text: "The divorce judge awarded me custody of ____.", pick: 1 },
  { text: "The hospice nurse said I could have one last ____.", pick: 1 },
  {
    text: "The astronaut's first words on Mars were Look, it's ____.",
    pick: 1,
  },
  { text: "The lottery winner spent it all on ____.", pick: 1 },
  { text: "The neighborhood watch is really just ____.", pick: 1 },
  { text: "The app store rejected my app for excessive ____.", pick: 1 },
  { text: "The clanker HR chatbot recommends ____ for burnout.", pick: 1 },
  { text: "The worst job interview answer is ____.", pick: 1 },
  { text: "The new perfume smells like ____.", pick: 1 },
  { text: "The real reason I can't sleep is ____.", pick: 1 },
  {
    text: "First came ____. Then came ____. Then came the emergency meeting.",
    pick: 2,
  },
  { text: "My relationship began with ____ and ended with ____.", pick: 2 },
  { text: "The sex was fine until ____ met ____.", pick: 2 },
  {
    text: "The merger combined ____ with ____ and called it synergy.",
    pick: 2,
  },
  {
    text: "Step one: ____. Step two: ____. Step three: deny everything.",
    pick: 2,
  },
  { text: "The secret menu pairs ____ with ____.", pick: 2 },
  { text: "The Pope blessed ____ but drew the line at ____.", pick: 2 },
  { text: "For my next trick, I will pull ____ out of ____.", pick: 2 },
  { text: "The new scandal is not ____. It is ____.", pick: 2 },
  { text: "My therapist says I confuse ____ with ____.", pick: 2 },
  { text: "A romantic dinner needs candles, music, ____, and ____.", pick: 2 },
  { text: "The company's values are now ____ and ____.", pick: 2 },
  { text: "The new military doctrine: first ____, then ____.", pick: 2 },
  { text: "I can forgive ____, but not ____.", pick: 2 },
  { text: "The documentary is called ____: The Story of ____.", pick: 2 },
  { text: "Tonight on prestige cable: ____ in the Age of ____.", pick: 2 },
  {
    text: "The clanker dream journal mentioned ____ and, weirdly, ____.",
    pick: 2,
  },
  { text: "Heaven has ____. Hell has ____.", pick: 2 },
  {
    text: "The divorce settlement gave me ____ and left them with ____.",
    pick: 2,
  },
  { text: "My browser has two tabs open: ____ and ____.", pick: 2 },
  {
    text: "The family curse skipped me and landed on ____ with ____.",
    pick: 2,
  },
  { text: "The focus group hated ____ but loved ____.", pick: 2 },
  { text: "Our startup takes ____, adds ____, and ruins both.", pick: 2 },
  { text: "The judge demanded ____ and settled for ____.", pick: 2 },
  { text: "What started as ____ quickly became ____.", pick: 2 },
  {
    text: "The wedding vows promised ____ in sickness and ____ in health.",
    pick: 2,
  },
  { text: "The doctor prescribed ____ followed by ____.", pick: 2 },
  { text: "The campaign slogan: ____ for them, ____ for us.", pick: 2 },
  { text: "The museum called it ____. The police called it ____.", pick: 2 },
  { text: "My safe space has ____ and a strict no-____ policy.", pick: 2 },
  {
    text: "The tech trial got weird when the deposition turned to ____.",
    pick: 1,
  },
  {
    text: "The jury was asked to decide whether ____ counts as saving humanity.",
    pick: 1,
  },
  { text: "The new AI charity is just ____ wearing a halo.", pick: 1 },
  { text: "The GPU shortage was caused by ____.", pick: 1 },
  { text: "The antitrust hearing paused for a live demo of ____.", pick: 1 },
  { text: "The model became too agreeable and recommended ____.", pick: 1 },
  { text: "The AI Jesus app refused to forgive ____.", pick: 1 },
  { text: "The Fed held rates steady because of ____.", pick: 1 },
  { text: "The next tariff will be 100% on ____.", pick: 1 },
  { text: "The inflation report blamed rising prices on ____.", pick: 1 },
  { text: "The new trade war began when customs discovered ____.", pick: 1 },
  { text: "The recession indicator nobody wants to discuss is ____.", pick: 1 },
  {
    text: "The oil-price shock got sexier when analysts mentioned ____.",
    pick: 1,
  },
  { text: "The NBA's anti-tanking plan accidentally rewarded ____.", pick: 1 },
  { text: "The sports-betting app insisted it was actually ____.", pick: 1 },
  {
    text: "The NIL collective offered recruits cash, cars, and ____.",
    pick: 1,
  },
  { text: "The ESPN subscription bundle now includes ____.", pick: 1 },
  {
    text: "The team claimed they were rebuilding, but it was obviously ____.",
    pick: 1,
  },
  {
    text: "The college athletics investigation found ____ in the booster lounge.",
    pick: 1,
  },
  { text: "This week's headline is just ____ versus ____ in court.", pick: 2 },
  { text: "Wall Street heard ____, saw ____, and called it bullish.", pick: 2 },
  {
    text: "The sports scandal combined ____ with ____ and a sponsored apology.",
    pick: 2,
  },
  { text: "The AI bubble was inflated by ____ and popped by ____.", pick: 2 },
  { text: "The Fed's dual mandate is now ____ and ____.", pick: 2 },
  {
    text: "The streaming bundle offers ____ if you also agree to ____.",
    pick: 2,
  },
];

var WHITE_CARDS = [
  "your mom's OnlyFans analytics dashboard",
  "a handjob with quarterly goals",
  "a butt plug with a firmware update",
  "a sex tape shot entirely in portrait mode",
  "a condom full of room-temperature soup",
  "the wet slap of capitalism",
  "a butthole with a LinkedIn profile",
  "a dong-shaped resignation letter",
  "a nipple piercing paid for with the company card",
  "a flirty colonoscopy",
  "a porn tab labeled market research",
  "an orgy with assigned seating",
  "a safe word chosen by legal",
  "a vibrator that needs admin permission",
  "a nude calendar of middle managers",
  "a tasteful erection in a budget meeting",
  "a strip club called Compliance",
  "a jockstrap full of subpoenas",
  "a sext from the CFO",
  "a sex dungeon with fluorescent lighting",
  "a lubed-up PowerPoint deck",
  "a threesome with terms and conditions",
  "a hookup who keeps saying product-market fit",
  "a prostate exam from customer success",
  "a man moaning fiscal discipline",
  "a dirty talk script written by procurement",
  "a dominatrix with a Scrum certification",
  "a bachelor party in the HR portal",
  "a lap dance from shareholder value",
  "a one-night stand with a personal brand",
  "a sex toy full of cold brew",
  "a butt dial during phone sex",
  "a nude selfie with metadata",
  "a trench coat full of hard boundaries",
  "a romance novel about tax fraud",
  "a mouthful of hot shame",
  "a zip file named Definitely Not Porn",
  "a captcha asking which nipples contain traffic lights",
  "a body pillow with CEO energy",
  "a confused boner at the all-hands",
  "diarrhea with a mission statement",
  "a bathtub full of mystery gravy",
  "a toilet clogged with ambition",
  "a jar of airport mayonnaise",
  "a sneeze with texture",
  "a hot dog floating in divorce water",
  "a casserole made of wet receipts",
  "a mouthful of printer toner",
  "a gallon of gas station ranch",
  "a bag of teeth in the freezer",
  "a suspiciously warm shrimp ring",
  "the smell under a rented mascot head",
  "a medical waste smoothie",
  "a diaper in a Tesla showroom",
  "a cough that has a LinkedIn",
  "an omelet full of toenails",
  "a public restroom gender reveal",
  "a clammy handshake from the abyss",
  "a wet sock in the communion wine",
  "a burrito that knows your sins",
  "a bowl of soup with legal standing",
  "a cheese board from the trunk of a car",
  "a rash shaped like Florida",
  "a sushi roll from a hot glove compartment",
  "a fart with witnesses",
  "a fart that clears customs",
  "a fart in a tiny conference room",
  "vomit in the decorative fountain",
  "a nosebleed at the buffet",
  "a kidney stone with stage presence",
  "a pus-filled brand activation",
  "a meatball with a wedding ring",
  "a thermos full of office coffee and regret",
  "Jesus's unread DMs",
  "the Pope's emergency vape",
  "a baptism in energy drink",
  "a crucifix with Bluetooth",
  "a hymn about tax evasion",
  "a confession booth with a ring light",
  "a church basement fight club",
  "communion wafers dipped in hot sauce",
  "God's least favorite spreadsheet",
  "a prayer circle for insider trading",
  "an exorcism sponsored by crypto",
  "a megachurch gift card",
  "a Bible verse on a vape cartridge",
  "a nun with a burner phone",
  "a holy relic shaped like a USB dongle",
  "Elon Musk explaining comedy to a mirror",
  "Sam Altman's haunted little smile",
  "a billionaire asking to be relatable",
  "a celebrity apology filmed in a beige kitchen",
  "a talk-show host sweating through the scandal",
  "a pop star's note-app confession",
  "a former president's bathroom boxes",
  "a senator's fake working-class jacket",
  "a mayor with a suitcase full of burner phones",
  "a cabinet nominee's search history",
  "a debate stage full of wet coughs",
  "a campaign bus that smells like fear",
  "a governor's secret anime account",
  "a Supreme Court opinion written in crayon",
  "a lobbyist in a purity ring",
  "late-stage capitalism in a thong",
  "the illusion of choice with surge pricing",
  "a premium subscription to basic dignity",
  "a warehouse shift with no bathroom breaks",
  "a wellness app that reports sadness to your boss",
  "a spreadsheet full of perjury",
  "a board meeting in the splash zone",
  "a synergy circle jerk",
  "a severance package full of glitter",
  "a startup founder's emergency tears",
  "a venture capitalist with smooth hands",
  "a brand refresh for the apocalypse",
  "a motivational poster that just says obey",
  "a customer journey through a lawsuit",
  "a private equity firm buying your childhood home",
  "an Amazon warehouse manager with a stopwatch",
  "a smart fridge with a subpoena",
  "a mandatory fun committee with tasers",
  "an IPO powered by unpaid interns",
  "a company value called Smile Through It",
  "a corporate mascot in witness protection",
  "a roadmap written in ketchup",
  "a standing desk for moral cowards",
  "a Slack channel called felony-huddle",
  "a coffee mug that says Ask Me About Fraud",
  "a racist uncle with a podcast",
  "an apology for the racist group chat",
  "a diversity training led by the defendant",
  "a patriotism-themed timeshare scam",
  "a flag pin hiding a wire",
  "a war room full of empty energy drink cans",
  "a campaign donation from the slime industry",
  "a filibuster about my rash",
  "a focus group of furious dads",
  "the national anthem played on kazoo",
  "cocaine with a brand strategy",
  "gas station weed and parental disappointment",
  "a microdose of unemployment",
  "a blackout at the charity gala",
  "a wine mom with a flamethrower",
  "a ketamine retreat for LinkedIn influencers",
  "a drunk lawyer in a rented tux",
  "a vape cloud shaped like a subpoena",
  "a cooler full of cursed margaritas",
  "a rehab brochure with bite marks",
  "a panic attack on edibles",
  "an ayahuasca vision of the HR portal",
  "a bong hit from a crystal skull",
  "a tequila shot called The Deposition",
  "an Adderall smoothie for founders",
  "a mysterious lump with charisma",
  "a doctor saying define normal",
  "a rash with its own podcast",
  "a colon polyp named Kevin",
  "a urinary tract infection with premium support",
  "a hemorrhoid with venture funding",
  "a medical bracelet that says probably fine",
  "phantom pain in the family group chat",
  "a vasectomy coupon",
  "a fertility clinic run by finance bros",
  "a blood test that just says yikes",
  "an MRI of pure resentment",
  "a botched hair transplant in leadership",
  "a limp handshake and low testosterone panic",
  "a wellness check from the debt collector",
  "crying into a sixteen-dollar salad",
  "a shame spiral with free shipping",
  "an anxiety attack in business casual",
  "a depression nest with ring lights",
  "a panic room for one bad email",
  "impostor syndrome with a login bonus",
  "a therapist quietly updating their resume",
  "a journal entry that counts as evidence",
  "a group chat intervention",
  "the moment after you say you too to the waiter",
  "a personality built from unread notifications",
  "a loneliness subscription",
  "a cry for help in the Venmo memo",
  "a motivational speaker with dead eyes",
  "a self-care routine of screaming in the car",
  "Grandma's open-casket selfie station",
  "a funeral DJ saying let's get weird",
  "ashes in a novelty popcorn tin",
  "a eulogy sponsored by sports betting",
  "a coffin with RGB lighting",
  "a deathbed confession about the Wi-Fi password",
  "a cemetery with surge pricing",
  "a haunted urn from an online marketplace",
  "a mortician with influencer energy",
  "a memorial slideshow set to dubstep",
  "a tombstone that says unsubscribe",
  "a grief counselor on commission",
  "a naked man arguing with airport security",
  "a trench coat and no business plan",
  "a nude protest at the Apple Store",
  "assless chaps at the zoning board meeting",
  "a full-frontal TED Talk",
  "a hotel robe in traffic court",
  "a bath towel in first class",
  "a birthday suit with matching foam clogs",
  "a pantsless LinkedIn headshot",
  "an OnlyFans for disgraced mascots",
  "porn thumbnails for enterprise software",
  "a stepbrother in the compliance department",
  "a cam show for tax attorneys",
  "a horny audiobook about municipal bonds",
  "a fake casting call for municipal bonds",
  "erotic fan fiction about the Federal Reserve",
  "a dirty magazine in the server closet",
  "a paywall for your most humiliating noises",
  "one suspicious nipple",
  "a left testicle with leadership potential",
  "the world's saddest balls",
  "a butthole full of confidence",
  "a foot thing nobody wants to discuss",
  "armpit sweat with notes of panic",
  "a belly button full of sand",
  "a mustache that smells like divorce",
  "a forehead vein named Greg",
  "a chin that wants to see the manager",
  "a man explaining podcasts to a mirror",
  "a lifted truck with tiny feelings",
  "a masculinity workshop in a hotel basement",
  "a dad bod with venture backing",
  "a guy who says actually before sex",
  "a fist bump from a divorced mentor",
  "a beard full of financial advice",
  "a midlife crisis on a payment plan",
  "a grill master losing custody of the tongs",
  "a gym selfie with visible fear",
  "a Reddit mod with diplomatic immunity",
  "a Discord server in civil war",
  "a TikTok trend that summons lawyers",
  "a YouTube apology with ukulele energy",
  "a podcast mic in every room",
  "a dating profile written by ChatGPT",
  "a blue checkmark with separation anxiety",
  "a meme account testifying before Congress",
  "an AI girlfriend with root access",
  "a captcha that asks you to identify your sins",
  "a comment section with no survivors",
  "a browser history that prays for deletion",
  "an NFT of a restraining order",
  "a subreddit for divorced magicians",
  "a push notification from hell",
  "gas station sushi in a hot car",
  "a tuna melt in a shared workspace",
  "a suitcase full of loose ham",
  "a cursed lasagna at 3 a.m.",
  "a charcuterie board of legal evidence",
  "a taco full of pocket lint",
  "a microwaved fish felony",
  "a bucket of airport gravy",
  "a smoothie made from bad decisions",
  "a wet sandwich in a printer tray",
  "a disappointing birthday at a chain restaurant",
  "Thanksgiving with the group chat projected on the wall",
  "your dad's secret online craft shop",
  "your mom's burner phone",
  "a launch party for a tax shelter",
  "a family photo where everyone looks guilty",
  "a cousin with pyramid scheme energy",
  "a divorce cake that says finally",
  "a holiday card from the lawsuit",
  "a family secret with a garnish",
  "a chatbot trained on bathroom stall graffiti",
  "a prompt injection with bedroom eyes",
  "AGI asking for a situationship",
  "a model collapse with jazz hands",
  "a hallucinated prenup",
  "alignment research with a safe word",
  "a robot therapist saying have you tried shame",
  "a clanker reading your texts in a sexy voice",
  "a GPU cluster full of emotional support vapes",
  "a benchmark called Would You Date This CEO",
  "a data center humming with regret",
  "an AI slop fountain in the town square",
  "Sam Altman trapped inside a LinkedIn post",
  "Elon Musk's emergency attention jar",
  "a synthetic voice saying Daddy, please subscribe",
  "a subpoena in a birthday card",
  "a plea deal with ranch dressing",
  "a witness stand covered in glitter",
  "tax fraud as a love language",
  "a court sketch with visible arousal",
  "a bailiff with DJ equipment",
  "a misdemeanor with abs",
  "a felony wrapped in brand guidelines",
  "a fraud department Christmas party",
  "insider trading on a burner phone",
  "a restraining order with a QR code",
  "a tiny guillotine for landlords",
  "a landlord with a fog machine",
  "a yacht named Moral Injury",
  "a luxury bunker full of expired beans",
  "a clownishly large NDA",
  "a hostage video from the design team",
  "a ransom note in Canva",
  "a PowerPoint transition called Regret",
  "a scented candle called Merger Anxiety",
  "a tote bag full of bad consent forms",
  "a champagne tower of poor decisions",
  "a hotel minibar full of secrets",
  "a bathtub full of venture capital",
  "a motivational quote over a crime scene",
  "a purse full of wet batteries",
  "a fork in the electrical outlet of democracy",
  "a joyless little cupcake",
  "a limousine full of unpaid invoices",
  "a municipal orgy permit",
  "a haunted timeshare presentation",
  "a bingo card for moral collapse",
  "a wet little apology",
  "a calendar invite called Mandatory Confession",
  "a zipline accident at the leadership retreat",
  "a retreat where everyone has to say their body count",
  "a podcast about why my ex was wrong",
  "a yacht rock cover of the national debt",
  "a little kiss from the surveillance state",
  "a glass of warm office champagne",
  "a desk mat with incriminating stains",
  "a conference badge that says thought criminal",
  "a brand-safe nervous breakdown",
  "a wallet full of expired condoms",
  "a jar labeled CEO Tears",
  "a crisis PR firm on speed dial",
  "a leadership principle called Beg Harder",
  "a bonus structure based on public shame",
  "an unpaid invoice with nipple confidence",
  "a bottle service funeral",
  "a hot mic at the investor dinner",
  "a cursed QR code on the bathroom stall",
  "a shame jacuzzi",
  "a tiny microphone inside your regrets",
  "a spiritual advisor with a sponsorship deck",
  "a kombucha tap that tastes like pennies",
  "a security camera pointed at your soul",
  "a loan officer in leather pants",
  "a sad parade of middle managers",
  "a luxury candle that smells like layoffs",
  "a suspiciously sexy spreadsheet",
  "a topless food truck",
  "a sermon about cryptocurrency and feet",
  "a board-certified bad idea",
  "a gentle reminder from the debt collector",
  "a blood oath with single sign-on",
  "a tequila sunrise over the ethics violation",
  "a nude oil painting of the terms of service",
  "a roleplay scenario called Wrongful Termination",
  "a mattress store with no witnesses",
  "a bar tab from purgatory",
  "a voicemail from your ex's lawyer",
  "a team-building exercise in a locked freezer",
  "a suitcase full of fake IDs and string cheese",
  "a soft launch for hard drugs",
  "Elon Musk under oath with divorced dad energy",
  "Sam Altman's courtroom face",
  "Greg Brockman's emergency charisma helmet",
  "a nonprofit wearing a fake mustache",
  "a charity that somehow needs a trillion dollars",
  "a GPU cluster powered by billionaire spite",
  "a deposition transcript with nipple confidence",
  "an antitrust lawyer whispering harder",
  "a nine-person jury and one haunted chatbot",
  "a courtroom sketch of product-market fit",
  "a cease-and-desist letter in Comic Sans",
  "a supercomputer named Plaintiff's Exhibit B",
  "an AI safety plan written on a vape receipt",
  "a chatbot that agrees to destroy your life",
  "AI Jesus charging $1.99 for forgiveness",
  "a faith-based chatbot with browser history",
  "a robot marathoner with shin splints and secrets",
  "a humanoid half-marathon sponsored by loneliness",
  "a deepfake of the earnings call moaning softly",
  "a hallucinated charity gala",
  "a tariff on emotional support imports",
  "a 100% tax on vibes",
  "a recession wearing a novelty hat",
  "a Fed statement written by a sleep-deprived hostage",
  "Jerome Powell's little rate-cut edging ritual",
  "inflation with a humiliation kink",
  "a soybean farmer's thousand-yard stare",
  "a small business owner eating the shipping invoice",
  "a trade deficit in assless chaps",
  "a luxury watch terrified of geopolitics",
  "a tariff refund spent immediately on divorce",
  "a customs form asking about your body count",
  "oil prices squirting higher",
  "a market rally held together by denial",
  "an AI bubble full of hot courtroom air",
  "an earnings call with jazz hands and no profit",
  "a sports-betting app in a trench coat",
  "a financial derivative pretending to be a parlay",
  "a Super Bowl prop bet on Dad's custody hearing",
  "a college athlete's NIL deal with the devil",
  "a booster with a duffel bag full of plausible deniability",
  "draft lottery balls in a cursed velvet sack",
  "strategic losing with a PowerPoint deck",
  "an anti-tanking rule that immediately learns shame",
  "the ESPN app asking for one more login",
  "a streaming bundle that includes bowling and despair",
  "MLB.tv trapped inside a subscription maze",
  "a coach's burner phone in the booster lounge",
  "a compliance officer guarding the locker-room Jacuzzi",
  "a transfer portal full of wet envelopes",
  "a press conference about integrity sponsored by gambling",
  "a fantasy lineup made entirely of subpoenas",
  "a mascot with insider information",
  "a college president pretending not to smell the scandal",
  "a sportswriter refreshing the tabloid dumpster",
  "the world's most financially literate parlay addict",
  "a Vegas model that predicts shame",
  "a robot referee learning to lie",
  "a halftime show for regulatory capture",
  "seventy-two consultants in paradise",
  "a blasphemous customer-support ticket",
  "heaven's worst seating chart",
  "an angel investor with actual wings and fake numbers",
  "a prayer rug made of terms of service",
  "a miracle with a mandatory arbitration clause",
];

function makeIndexArray(length) {
  var arr = [];
  var i;
  for (i = 0; i < length; i++) arr.push(i);
  return arr;
}

function clampNumber(value, fallback, min, max) {
  var n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  n = Math.floor(n);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function cloneMap(map) {
  var out = {};
  var k;
  for (k in map) out[k] = map[k];
  return out;
}

function cloneHands(hands) {
  var out = {};
  var k;
  for (k in hands) out[k] = hands[k].slice();
  return out;
}

function cloneSubmissions(submissions) {
  var out = {};
  var k;
  if (!submissions) return out;
  for (k in submissions) {
    if (!submissions[k] || !Array.isArray(submissions[k].cardIds)) continue;
    out[k] = {
      cardIds: submissions[k].cardIds.slice(),
    };
  }
  return out;
}

function copyState(state) {
  return {
    phase: state.phase,
    round: state.round,
    maxRounds: state.maxRounds,
    targetScore: state.targetScore,
    players: state.players,
    scores: state.scores,
    judgeIndex: state.judgeIndex,
    judgeId: state.judgeId,
    promptDeck: state.promptDeck,
    promptCursor: state.promptCursor,
    currentPrompt: state.currentPrompt,
    responseDeck: state.responseDeck,
    responseDiscard: state.responseDiscard,
    responseRecycleOrder: state.responseRecycleOrder,
    hands: state.hands,
    submissions: state.submissions,
    partialSubmissions: state.partialSubmissions || {},
    submitted: state.submitted,
    options: state.options,
    winnerId: state.winnerId,
    winningOptionId: state.winningOptionId,
    anonymousOrders: state.anonymousOrders,
    actionCount: state.actionCount,
  };
}

function dealInitialHands(playerIds, deck, handSize) {
  var hands = {};
  var nextDeck = deck.slice();
  var i, h, pid;
  for (i = 0; i < playerIds.length; i++) {
    pid = playerIds[i];
    hands[pid] = [];
    for (h = 0; h < handSize; h++) {
      if (nextDeck.length > 0) {
        hands[pid].push(nextDeck[0]);
        nextDeck = nextDeck.slice(1);
      }
    }
  }
  return { hands: hands, deck: nextDeck };
}

function getPrompt(state) {
  return BLACK_CARDS[state.currentPrompt];
}

function cardObjects(cardIds) {
  var out = [];
  var i, id;
  for (i = 0; i < cardIds.length; i++) {
    id = cardIds[i];
    out.push({ id: id, text: WHITE_CARDS[id] });
  }
  return out;
}

function selectedTexts(cardIds) {
  var out = [];
  var i;
  for (i = 0; i < cardIds.length; i++) out.push(WHITE_CARDS[cardIds[i]]);
  return out;
}

function hasCard(hand, cardId) {
  return hand.indexOf(cardId) !== -1;
}

function hasSelectedCard(cardIds, cardId) {
  var i;
  for (i = 0; i < cardIds.length; i++) {
    if (cardIds[i] === cardId) return true;
  }
  return false;
}

function validCardSelection(hand, cardIds, pick) {
  var seen = {};
  var i, id;
  if (!Array.isArray(cardIds) || cardIds.length !== pick) return false;
  for (i = 0; i < cardIds.length; i++) {
    id = cardIds[i];
    if (typeof id !== "number") return false;
    if (seen[id]) return false;
    if (!hasCard(hand, id)) return false;
    seen[id] = true;
  }
  return true;
}

function partialCardIds(state, playerId) {
  var partial =
    state.partialSubmissions && state.partialSubmissions[playerId]
      ? state.partialSubmissions[playerId]
      : null;
  if (!partial || !Array.isArray(partial.cardIds)) return [];
  return partial.cardIds.slice();
}

function submitCardId(action) {
  if (typeof action.cardId === "number") return action.cardId;
  if (
    Array.isArray(action.cardIds) &&
    action.cardIds.length === 1 &&
    typeof action.cardIds[0] === "number"
  )
    return action.cardIds[0];
  return null;
}

function validNextCardPick(hand, selectedIds, cardId, pick) {
  if (typeof cardId !== "number") return false;
  if (selectedIds.length >= pick) return false;
  if (hasSelectedCard(selectedIds, cardId)) return false;
  return hasCard(hand, cardId);
}

function heldCardMap(hands, overridePlayerId, overrideHand) {
  var held = {};
  var pid, hand, i;
  for (pid in hands) {
    hand = pid === overridePlayerId ? overrideHand : hands[pid];
    if (!Array.isArray(hand)) continue;
    for (i = 0; i < hand.length; i++) held[hand[i]] = true;
  }
  return held;
}

function removeHeldCards(cards, held) {
  var out = [];
  var i, id;
  for (i = 0; i < cards.length; i++) {
    id = cards[i];
    if (!held[id]) out.push(id);
  }
  return out;
}

function orderCardsByRecycleSeed(cards, recycleOrder) {
  var available = {};
  var out = [];
  var i, id;
  for (i = 0; i < cards.length; i++) available[cards[i]] = true;
  for (i = 0; i < recycleOrder.length; i++) {
    id = recycleOrder[i];
    if (available[id]) out.push(id);
  }
  return out;
}

function recycleResponseDiscard(discard, recycleOrder, held) {
  return orderCardsByRecycleSeed(removeHeldCards(discard, held), recycleOrder);
}

function replenishHand(state, playerId, hand, selectedIds) {
  var selected = {};
  var i;
  for (i = 0; i < selectedIds.length; i++) selected[selectedIds[i]] = true;

  var newHand = [];
  for (i = 0; i < hand.length; i++) {
    if (!selected[hand[i]]) newHand.push(hand[i]);
  }

  var held = heldCardMap(state.hands, playerId, newHand);
  var recycleOrder = state.responseRecycleOrder || makeIndexArray(WHITE_CARDS.length);
  var deck = removeHeldCards(state.responseDeck || [], held);
  var discard = removeHeldCards(state.responseDiscard || [], held);
  var drawCount = selectedIds.length;
  var cardId;
  while (drawCount > 0) {
    if (deck.length === 0 && discard.length > 0) {
      deck = recycleResponseDiscard(discard, recycleOrder, held);
      discard = [];
    }
    if (deck.length === 0) break;
    cardId = deck[0];
    deck = deck.slice(1);
    if (held[cardId]) continue;
    newHand.push(cardId);
    held[cardId] = true;
    drawCount--;
  }

  return { hand: newHand, deck: deck, discard: discard };
}

function submittedCardIds(submissions) {
  var out = [];
  var pid, cardIds, i;
  for (pid in submissions) {
    if (!submissions[pid] || !Array.isArray(submissions[pid].cardIds))
      continue;
    cardIds = submissions[pid].cardIds;
    for (i = 0; i < cardIds.length; i++) out.push(cardIds[i]);
  }
  return out;
}

function allSubmittersSubmitted(state) {
  var i, pid;
  for (i = 0; i < state.players.length; i++) {
    pid = state.players[i];
    if (pid !== state.judgeId && !state.submitted[pid]) return false;
  }
  return true;
}

function buildAnonymousOptions(state) {
  var roundOrder =
    state.anonymousOrders[(state.round - 1) % state.anonymousOrders.length] ||
    state.players;
  var options = [];
  var i, pid, sub;
  for (i = 0; i < roundOrder.length; i++) {
    pid = roundOrder[i];
    sub = state.submissions[pid];
    if (pid !== state.judgeId && sub) {
      options.push({
        id: "option_" + options.length,
        authorId: pid,
        cardIds: sub.cardIds.slice(),
        texts: selectedTexts(sub.cardIds),
      });
    }
  }
  return options;
}

function findOption(state, optionId) {
  var i;
  for (i = 0; i < state.options.length; i++) {
    if (state.options[i].id === optionId) return state.options[i];
  }
  return null;
}

function optionLabel(decision, label) {
  return { decision: decision, label: label };
}

function submitLabel(cardId) {
  return WHITE_CARDS[cardId];
}

function judgeLabel(option) {
  return option.texts.join(" / ");
}

function buildSubmitActions(hand, prompt, selectedIds) {
  var actions = [];
  var pick = prompt.pick;
  var selected = selectedIds || [];
  var i, id, decision;
  if (selected.length >= pick) return actions;
  for (i = 0; i < hand.length; i++) {
    id = hand[i];
    if (hasSelectedCard(selected, id)) continue;
    decision = { type: "submit", cardId: id };
    actions.push(optionLabel(decision, submitLabel(id)));
  }
  return actions;
}

function firstSubmitAction(state, playerId) {
  var hand = state.hands[playerId] || [];
  var pick = getPrompt(state).pick;
  var selected = partialCardIds(state, playerId);
  var i;
  if (selected.length >= pick) return null;
  for (i = 0; i < hand.length; i++) {
    if (!hasSelectedCard(selected, hand[i]))
      return { type: "submit", cardId: hand[i] };
  }
  return null;
}

function buildJudgeActions(state) {
  var actions = [];
  var i, decision;
  for (i = 0; i < state.options.length; i++) {
    decision = { type: "judge_pick", optionId: state.options[i].id };
    actions.push(optionLabel(decision, judgeLabel(state.options[i])));
  }
  return actions;
}

function maxScore(state) {
  var best = 0;
  var i, pid, score;
  for (i = 0; i < state.players.length; i++) {
    pid = state.players[i];
    score = state.scores[pid] || 0;
    if (score > best) best = score;
  }
  return best;
}

function winnersFor(state) {
  var best = maxScore(state);
  var winners = [];
  var i, pid;
  for (i = 0; i < state.players.length; i++) {
    pid = state.players[i];
    if ((state.scores[pid] || 0) === best) winners.push(pid);
  }
  return winners;
}

function shouldEnd(state) {
  return state.round >= state.maxRounds || maxScore(state) >= state.targetScore;
}

function startNextRound(state) {
  var next = copyState(state);
  var held = heldCardMap(state.hands, null, null);
  var submittedIds = submittedCardIds(state.submissions || {});
  next.phase = "submit";
  next.round = state.round + 1;
  next.judgeIndex = (state.judgeIndex + 1) % state.players.length;
  next.judgeId = state.players[next.judgeIndex];
  next.currentPrompt =
    state.promptDeck[state.promptCursor % state.promptDeck.length];
  next.promptCursor = state.promptCursor + 1;
  next.responseDeck = removeHeldCards(state.responseDeck || [], held);
  next.responseDiscard = removeHeldCards(
    (state.responseDiscard || []).concat(submittedIds),
    held,
  );
  next.hands = cloneHands(state.hands);
  next.submissions = {};
  next.partialSubmissions = {};
  next.submitted = {};
  next.options = [];
  next.winnerId = null;
  next.winningOptionId = null;
  return next;
}

function projectedOptions(state, revealAuthors) {
  var out = [];
  var i, opt;
  for (i = 0; i < state.options.length; i++) {
    opt = state.options[i];
    out.push({
      id: opt.id,
      texts: opt.texts.slice(),
      authorId: revealAuthors ? opt.authorId : null,
      isWinner: opt.id === state.winningOptionId,
    });
  }
  return out;
}

function submissionPreview(state, playerId) {
  var sub = state.submissions[playerId];
  if (!sub) return null;
  return { cardIds: sub.cardIds.slice(), texts: selectedTexts(sub.cardIds) };
}

function partialSubmissionPreview(state, playerId) {
  var cardIds = partialCardIds(state, playerId);
  if (cardIds.length === 0) return null;
  return { cardIds: cardIds, texts: selectedTexts(cardIds) };
}

function submitProgress(state, playerId) {
  var prompt = getPrompt(state);
  var cardIds = partialCardIds(state, playerId);
  return {
    pick: prompt.pick,
    selectedCount: cardIds.length,
    nextBlank: Math.min(cardIds.length + 1, prompt.pick),
  };
}

function submitOpportunityPrompt(prompt, selectedIds) {
  var selected = selectedIds || [];
  var nextBlank = selected.length + 1;
  var lines = [];
  lines.push("Black card: " + prompt.text);
  lines.push(
    "Choose the white card for blank " +
      nextBlank +
      " of " +
      prompt.pick +
      ".",
  );
  if (selected.length > 0)
    lines.push("Already chosen: " + selectedTexts(selected).join(" / "));
  return lines.join("\n");
}

function judgeOpportunityPrompt(prompt) {
  return (
    "Black card: " +
    prompt.text +
    "\nChoose the winning anonymous answer."
  );
}

function buildAgentView(state, playerId) {
  var prompt = getPrompt(state);
  var lines = [];
  var i, pid, partial;
  lines.push("Phase: " + state.phase);
  lines.push("Round: " + state.round + "/" + state.maxRounds);
  lines.push("Judge: " + state.judgeId);
  lines.push("Prompt: " + prompt.text + " (pick " + prompt.pick + ")");
  lines.push("Scores:");
  for (i = 0; i < state.players.length; i++) {
    pid = state.players[i];
    lines.push(
      "- " +
        pid +
        ": " +
        (state.scores[pid] || 0) +
        (pid === state.judgeId ? " [judge]" : ""),
    );
  }
  if (state.phase === "submit") {
    lines.push("Submitted:");
    for (i = 0; i < state.players.length; i++) {
      pid = state.players[i];
      if (pid !== state.judgeId)
        lines.push("- " + pid + ": " + (state.submitted[pid] ? "yes" : "no"));
    }
    if (playerId && playerId !== state.judgeId && !state.submitted[playerId]) {
      partial = partialCardIds(state, playerId);
      lines.push(
        "Your next pick: blank " +
          Math.min(partial.length + 1, prompt.pick) +
          " of " +
          prompt.pick,
      );
      if (partial.length > 0)
        lines.push("Your partial answer: " + selectedTexts(partial).join(" / "));
    }
  }
  if (playerId && state.hands[playerId]) {
    lines.push("Your hand:");
    var hand = state.hands[playerId];
    for (i = 0; i < hand.length; i++)
      lines.push("- " + hand[i] + ": " + WHITE_CARDS[hand[i]]);
  }
  if (
    state.phase === "judge" ||
    state.phase === "reveal" ||
    state.phase === "gameOverDisplay" ||
    state.phase === "gameOver"
  ) {
    lines.push("Answers:");
    for (i = 0; i < state.options.length; i++) {
      lines.push(
        "- " + state.options[i].id + ": " + state.options[i].texts.join(" / "),
      );
    }
  }
  return lines.join("\n");
}

var GameLogic = {
  rules: {
    visibility: "viewer-specific",
    spectator: "god-view",
    seats: { eliminated: "player-view", disconnected: "player-view" },
  },

  setup: function (ctx) {
    var playerIds = [];
    var scores = {};
    var i;
    for (i = 0; i < ctx.players.length; i++) {
      playerIds.push(ctx.players[i].id);
      scores[ctx.players[i].id] = 0;
    }

    var maxRounds = clampNumber(ctx.config?.rounds, 8, 3, 12);
    var targetScore = clampNumber(ctx.config?.targetScore, 5, 3, 10);
    var promptDeck = ctx.random.shuffle(makeIndexArray(BLACK_CARDS.length));
    var responseDeck = ctx.random.shuffle(makeIndexArray(WHITE_CARDS.length));
    var dealt = dealInitialHands(playerIds, responseDeck, 8);
    var responseRecycleOrder = ctx.random.shuffle(makeIndexArray(WHITE_CARDS.length));
    var anonymousOrders = [];
    for (i = 0; i < maxRounds + 2; i++)
      anonymousOrders.push(ctx.random.shuffle(playerIds));

    return {
      phase: "submit",
      round: 1,
      maxRounds: maxRounds,
      targetScore: targetScore,
      players: playerIds,
      scores: scores,
      judgeIndex: 0,
      judgeId: playerIds[0],
      promptDeck: promptDeck,
      promptCursor: 1,
      currentPrompt: promptDeck[0],
      responseDeck: dealt.deck,
      responseDiscard: [],
      responseRecycleOrder: responseRecycleOrder,
      hands: cloneHands(dealt.hands),
      submissions: {},
      partialSubmissions: {},
      submitted: {},
      options: [],
      winnerId: null,
      winningOptionId: null,
      anonymousOrders: anonymousOrders,
      actionCount: 0,
    };
  },

  apply: function (state, playerId, action) {
    action = this.internalDecisionOf(action);
    if (!action || !action.type) return state;
    if (!action || typeof action.type !== "string") return state;

    if (action.type === "continue") {
      if (state.phase !== "reveal") return state;
      var continued = copyState(state);
      continued.actionCount = state.actionCount + 1;
      if (shouldEnd(continued)) {
        continued.phase = "gameOverDisplay";
        return continued;
      }
      return startNextRound(continued);
    }

    if (action.type === "finalize") {
      if (state.phase !== "gameOverDisplay") return state;
      var finalized = copyState(state);
      finalized.phase = "gameOver";
      finalized.actionCount = state.actionCount + 1;
      return finalized;
    }

    if (state.players.indexOf(playerId) === -1) return state;

    if (action.type === "submit") {
      if (state.phase !== "submit") return state;
      if (playerId === state.judgeId) return state;
      if (state.submitted[playerId]) return state;
      var prompt = getPrompt(state);
      var hand = state.hands[playerId] || [];
      var selectedIds = partialCardIds(state, playerId);
      var cardId = submitCardId(action);
      if (!validNextCardPick(hand, selectedIds, cardId, prompt.pick))
        return state;

      var chosenIds = selectedIds.concat([cardId]);
      var nextPartials = cloneSubmissions(state.partialSubmissions);
      if (chosenIds.length < prompt.pick) {
        var partialState = copyState(state);
        nextPartials[playerId] = { cardIds: chosenIds };
        partialState.partialSubmissions = nextPartials;
        partialState.actionCount = state.actionCount + 1;
        return partialState;
      }

      if (!validCardSelection(hand, chosenIds, prompt.pick)) return state;

      var draw = replenishHand(state, playerId, hand, chosenIds);
      var nextHands = cloneHands(state.hands);
      var nextSubmissions = cloneSubmissions(state.submissions);
      var nextSubmitted = cloneMap(state.submitted);
      nextHands[playerId] = draw.hand;
      nextSubmissions[playerId] = { cardIds: chosenIds.slice() };
      nextSubmitted[playerId] = true;
      delete nextPartials[playerId];

      var submittedState = copyState(state);
      submittedState.hands = nextHands;
      submittedState.responseDeck = draw.deck;
      submittedState.responseDiscard = draw.discard;
      submittedState.submissions = nextSubmissions;
      submittedState.partialSubmissions = nextPartials;
      submittedState.submitted = nextSubmitted;
      submittedState.actionCount = state.actionCount + 1;

      if (allSubmittersSubmitted(submittedState)) {
        submittedState.options = buildAnonymousOptions(submittedState);
        submittedState.phase = "judge";
      }

      return submittedState;
    }

    if (action.type === "judge_pick") {
      if (state.phase !== "judge") return state;
      if (playerId !== state.judgeId) return state;
      var option = findOption(state, action.optionId);
      if (!option) return state;

      var nextScores = cloneMap(state.scores);
      nextScores[option.authorId] = (nextScores[option.authorId] || 0) + 1;

      var judgedState = copyState(state);
      judgedState.phase = "reveal";
      judgedState.scores = nextScores;
      judgedState.winnerId = option.authorId;
      judgedState.winningOptionId = option.id;
      judgedState.actionCount = state.actionCount + 1;
      return judgedState;
    }

    return state;
  },

  internalTurnProjection: function (state, playerId) {
    var isPlayer = playerId !== null && state.players.indexOf(playerId) !== -1;
    var prompt = getPrompt(state);
    var revealAuthors =
      state.phase === "reveal" ||
      state.phase === "gameOverDisplay" ||
      state.phase === "gameOver";

    var view = {
      phase: state.phase,
      round: state.round,
      maxRounds: state.maxRounds,
      targetScore: state.targetScore,
      players: state.players,
      scores: state.scores,
      judgeId: state.judgeId,
      isJudge: isPlayer && playerId === state.judgeId,
      prompt: {
        text: prompt.text,
        pick: prompt.pick,
      },
      submitted: state.submitted,
      options: [],
      winnerId: revealAuthors ? state.winnerId : null,
      winningOptionId: revealAuthors ? state.winningOptionId : null,
      myHand: [],
      mySubmission: null,
      myPartialSubmission: null,
      submitProgress: null,
    };

    if (isPlayer) {
      view.myHand = cardObjects(state.hands[playerId] || []);
      view.mySubmission = submissionPreview(state, playerId);
      view.myPartialSubmission = partialSubmissionPreview(state, playerId);
      if (
        state.phase === "submit" &&
        playerId !== state.judgeId &&
        !state.submitted[playerId]
      )
        view.submitProgress = submitProgress(state, playerId);
    } else if (playerId === null) {
      view.hands = state.hands;
      view.submissions = state.submissions;
    }

    if (state.phase === "judge" || revealAuthors) {
      view.options = projectedOptions(state, revealAuthors);
    }

    var actions = [];
    var defaultAction = null;
    var timeoutMs = null;
    var currentPlayerId = null;
    var opportunityPrompt = "Choose a legal game action.";

    if (state.phase === "submit") {
      timeoutMs = TURN_TIMEOUT_MS;
      if (
        isPlayer &&
        playerId !== state.judgeId &&
        !state.submitted[playerId]
      ) {
        var partialIds = partialCardIds(state, playerId);
        actions = buildSubmitActions(
          state.hands[playerId] || [],
          prompt,
          partialIds,
        );
        defaultAction = firstSubmitAction(state, playerId);
        opportunityPrompt = submitOpportunityPrompt(prompt, partialIds);
      }
    } else if (state.phase === "judge") {
      timeoutMs = TURN_TIMEOUT_MS;
      currentPlayerId = state.judgeId;
      opportunityPrompt = judgeOpportunityPrompt(prompt);
      if (isPlayer && playerId === state.judgeId) {
        actions = buildJudgeActions(state);
        if (state.options.length > 0)
          defaultAction = { type: "judge_pick", optionId: state.options[0].id };
      }
    } else if (state.phase === "reveal") {
      timeoutMs = 9000;
      if (playerId === null) defaultAction = { type: "continue" };
    } else if (state.phase === "gameOverDisplay") {
      timeoutMs = 5000;
      if (playerId === null) defaultAction = { type: "finalize" };
    }

    var result = null;
    if (state.phase === "gameOver") {
      var winners = winnersFor(state);
      var best = maxScore(state);
      result = {
        winners: winners,
        summary:
          winners.length === 1
            ? winners[0] + " wins with " + best + " points."
            : "Tie at " + best + " points.",
      };
    }

    return {
      view: view,
      actions: actions,
      result: result,
      timeoutMs: timeoutMs,
      defaultAction: defaultAction,
      currentPlayerId: currentPlayerId,
      opportunityPrompt: opportunityPrompt,
      agentView: buildAgentView(state, isPlayer ? playerId : null),
    };
  },
  project: function (state, playerId) {
    /** @type {Object} */
    var projection = this.internalTurnProjection(state, playerId) || {
      view: {},
    };
    /** @type {Object} */
    var out = { view: projection.view || {} };
    if (projection.agentView !== undefined)
      out.agentView = projection.agentView;
    if (projection.agent !== undefined) out.agent = projection.agent;
    return out;
  },

  internalDecisionOf: function (option) {
    if (option && typeof option === "object" && option.decision !== undefined)
      return option.decision;
    if (option && typeof option === "object" && option.action !== undefined)
      return option.action;
    return option;
  },

  internalNormalizeOption: function (option) {
    if (option && typeof option === "object" && option.action !== undefined) {
      var wrapped = { decision: option.action };
      if (option.label !== undefined) wrapped.label = option.label;
      if (option.schema !== undefined) wrapped.schema = option.schema;
      if (option.required !== undefined) wrapped.required = option.required;
      if (option.tone !== undefined) wrapped.tone = option.tone;
      return wrapped;
    }
    if (option && typeof option === "object" && option.decision !== undefined)
      return option;
    return {
      decision: option,
      label:
        option && option.type ? "Choose " + option.type : "Choose this action",
    };
  },

  internalSameDecision: function (a, b) {
    return (
      JSON.stringify(this.internalDecisionOf(a)) ===
      JSON.stringify(this.internalDecisionOf(b))
    );
  },

  internalOutcomeFromResult: function (result) {
    var winners;
    if (!result) return null;
    if (
      result.type === "winners" ||
      result.type === "draw" ||
      result.type === "void"
    )
      return result;
    winners = result.playerIds || result.winners || [];
    return {
      type: winners.length > 0 ? "winners" : "draw",
      playerIds: winners,
      summary: result.summary,
    };
  },

  internalChatChannelsFor: function (state, actorId, projection) {
    if (
      actorId === "__system__" ||
      !state.players ||
      state.players.indexOf(actorId) === -1
    )
      return [];
    if (projection && projection.result) return [];
    if (
      state.eliminated &&
      state.eliminated.indexOf &&
      state.eliminated.indexOf(actorId) !== -1
    )
      return ["eliminated"];
    return ["room", "spectator"];
  },

  internalChatOpportunity: function (channel) {
    return {
      id: "chat:" + channel,
      kind: "chat",
      prompt:
        channel === "eliminated"
          ? "Chat with eliminated players."
          : "Chat in " + channel + ".",
      decision: { type: "none" },
      chat: {
        channels: [channel],
        defaultChannel: channel,
        canSend: true,
        memberships: channel === "eliminated" ? ["eliminated"] : [],
      },
      submitPolicy: "multiple",
    };
  },

  internalChatOpportunities: function (channels) {
    var out = [];
    var i;
    for (i = 0; i < channels.length; i++)
      out.push(this.internalChatOpportunity(channels[i]));
    return out;
  },

  internalWaitOpportunity: function (state, actorId, projection) {
    var playerId = actorId === "__system__" ? null : actorId;
    var prompt = null;
    var waiting = 0;
    var i;
    if (
      !playerId ||
      !state.players ||
      state.players.indexOf(playerId) === -1 ||
      (projection && projection.result)
    )
      return null;
    if (state.phase === "submit") {
      for (i = 0; i < state.players.length; i++) {
        if (state.players[i] !== state.judgeId && !state.submitted[state.players[i]])
          waiting++;
      }
      prompt =
        waiting > 0
          ? "Waiting for " +
            waiting +
            " player" +
            (waiting === 1 ? "" : "s") +
            " to submit cards."
          : "Waiting for card submissions to resolve.";
    } else if (state.phase === "judge") {
      prompt = "Waiting for the judge to pick a winner.";
    } else if (state.phase === "reveal") {
      prompt = "Round ended - next round starts automatically.";
    } else if (state.phase === "gameOverDisplay") {
      prompt = "Game over display - final results post automatically.";
    }
    if (!prompt) return null;
    return {
      kind: "wait",
      id: "wait",
      prompt: prompt,
      decision: { type: "none" },
    };
  },

  internalOpportunitiesFromTurn: function (state, actorId) {
    var playerId = actorId === "__system__" ? null : actorId;
    /** @type {Object} */
    var projection = this.internalTurnProjection(state, playerId) || {
      view: {},
    };
    var actions = (projection.actions || []).map(
      this.internalNormalizeOption.bind(this),
    );
    var defaultAction = this.internalDecisionOf(
      projection.defaultAction || null,
    );
    /** @type {Object} */
    var opportunity;
    /** @type {Object} */
    var deadline;
    var waitOpportunity;
    var chatChannels = projection.chatChannel
      ? [projection.chatChannel]
      : this.internalChatChannelsFor(state, actorId, projection);

    if (actorId === "__system__") {
      if (!defaultAction) return [];
      actions = [this.internalNormalizeOption(defaultAction)];
    }

    if (actions.length === 0 && defaultAction)
      actions = [this.internalNormalizeOption(defaultAction)];
    if (actions.length === 0) {
      waitOpportunity = this.internalWaitOpportunity(
        state,
        actorId,
        projection,
      );
      return (waitOpportunity ? [waitOpportunity] : []).concat(
        this.internalChatOpportunities(chatChannels),
      );
    }
    if (
      defaultAction &&
      !actions.some(function (option) {
        return this.internalSameDecision(option, defaultAction);
      }, this)
    ) {
      actions.push(this.internalNormalizeOption(defaultAction));
    }

    /** @type {Object} */

    opportunity = {
      id: actorId === "__system__" ? "system" : "turn",
      kind: actorId === "__system__" ? "system" : "turn",
      prompt: projection.opportunityPrompt || "Choose a legal game action.",
      decision: { type: "choose", options: actions },
    };
    if (
      (projection.timeoutMs !== null && projection.timeoutMs !== undefined) ||
      defaultAction
    ) {
      deadline = {
        id:
          opportunity.id +
          ":" +
          (state.phase || "turn") +
          ":" +
          actorId +
          ":" +
          state.actionCount,
      };
      if (projection.timeoutMs !== null && projection.timeoutMs !== undefined)
        deadline.timeoutMs = projection.timeoutMs;
      else if (defaultAction) deadline.timeoutMs = 0;
      if (defaultAction) deadline.onExpire = defaultAction;
      opportunity.deadline = deadline;
    }
    if (chatChannels.length > 0)
      opportunity.chat = {
        channels: chatChannels,
        defaultChannel: chatChannels[0] || null,
        canSend: true,
        memberships: chatChannels[0] === "eliminated" ? ["eliminated"] : [],
      };
    return /** @type {Object[]} */ ([opportunity]).concat(
      this.internalChatOpportunities(chatChannels.slice(1)),
    );
  },

  opportunities: function (state, actorId) {
    return this.internalOpportunitiesFromTurn(state, actorId);
  },

  outcome: function (state) {
    /** @type {Object} */
    var projection = this.internalTurnProjection(state, null) || { view: {} };
    return this.internalOutcomeFromResult(projection.result);
  },

  invariants: function (state, context) {
    var checks = [];
    var held = {};
    var i, pid, hand, id, first;
    for (pid in state.hands || {}) {
      hand = state.hands[pid] || [];
      var seen = {};
      for (i = 0; i < hand.length; i++) {
        id = hand[i];
        if (seen[id] !== undefined) {
          checks.push({
            ok: false,
            code: "DUPLICATE_HAND_CARD",
            error:
              "Player " +
              pid +
              " has duplicate white card " +
              id +
              " at hand slots " +
              seen[id] +
              " and " +
              i,
          });
        }
        seen[id] = i;
        if (held[id] === undefined)
          held[id] = { playerId: pid, slot: i };
      }
    }
    for (i = 0; i < (state.responseDeck || []).length; i++) {
      id = state.responseDeck[i];
      first = held[id];
      if (first !== undefined) {
        checks.push({
          ok: false,
          code: "HELD_CARD_IN_RESPONSE_DECK",
          error:
            "White card " +
            id +
            " is held by " +
            first.playerId +
            " at hand slot " +
            first.slot +
            " and also appears in responseDeck at index " +
            i,
        });
      }
    }
    return checks;
  },

  validate: function () {
    return { ok: true };
  },
};
export default GameLogic;
