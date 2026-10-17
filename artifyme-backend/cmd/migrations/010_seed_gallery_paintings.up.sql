-- Ensure artist profile for default artist exists
INSERT INTO artist_profiles (artist_id, bio, experience_years, verified, created_at, updated_at)
VALUES (
    'e8d28200-9727-4246-b5a8-b4debd00710c',
    'Master portrait artist specializing in hyper-realistic graphite pencil, charcoal, watercolor, acrylic, and oil paintings.',
    10,
    true,
    NOW(),
    NOW()
) ON CONFLICT (artist_id) DO UPDATE SET
    verified = true,
    bio = EXCLUDED.bio,
    experience_years = EXCLUDED.experience_years,
    updated_at = NOW();

-- Clean up any placeholder test painting from initial schema setup
DELETE FROM artist_paintings WHERE image_url LIKE '%i.pinimg.com%';

-- Seed authentic curated paintings into artist_paintings
INSERT INTO artist_paintings (artist_id, title, description, category, image_url, created_at, updated_at)
SELECT 
    'e8d28200-9727-4246-b5a8-b4debd00710c',
    v.title,
    v.description,
    v.category::painting_category,
    v.image_url,
    v.created_at,
    v.created_at
FROM (VALUES
    -- PENCIL (Graphite Pencil Sketches)
    (
        'Mother & Daughter Bond',
        'Delicate graphite pencil artwork capturing the heartfelt bond between mother and daughter, drawn with fine tonal grades on archival paper.',
        'PENCIL',
        '/paintings/FotoGrid_20230705_151914628.jpg',
        TIMESTAMPTZ '2023-07-05 15:19:14+05:30'
    ),
    (
        'Traditional Couple Celebration Sketch',
        'Intricately detailed graphite portrait in traditional Indian wedding attire with ornate vest and saree embroidery.',
        'PENCIL',
        '/paintings/PhotoGrid_1580669157513.jpg',
        TIMESTAMPTZ '2020-02-02 23:25:57+05:30'
    ),
    (
        'Wedding Couple Graphite Portrait',
        'Soft graphite pencil portrait capturing warm smiles and wedding attire details.',
        'PENCIL',
        '/paintings/PhotoGrid_1581055303423.jpg',
        TIMESTAMPTZ '2020-02-07 10:41:43+05:30'
    ),
    (
        'Modern Woman Portrait',
        'Contemporary graphite portrait capturing sparkling expression, glasses, and denim jacket texture.',
        'PENCIL',
        '/paintings/PhotoGrid_1581056490239.jpg',
        TIMESTAMPTZ '2020-02-07 11:01:30+05:30'
    ),
    (
        'Golden Anniversary Couple Sketch',
        'Loving tribute portrait of an elderly couple rendered with fine graphite pencils and realistic facial contours.',
        'PENCIL',
        '/paintings/PhotoGrid_1581056666012.jpg',
        TIMESTAMPTZ '2020-02-07 11:04:26+05:30'
    ),
    (
        'Charming Baby with Cap',
        'Adorable pencil sketch of a baby with big curious eyes and a backwards cap, hand-shaded with 2B-6B pencils.',
        'PENCIL',
        '/paintings/PhotoGrid_1581058907670.jpg',
        TIMESTAMPTZ '2019-12-26 18:00:00+05:30'
    ),
    (
        'Joyful Smiling Woman Sketch',
        'Clean and vibrant pencil shading highlighting a natural glowing smile and flowing hair.',
        'PENCIL',
        '/paintings/Screenshot_20211223-215639__01.jpg',
        TIMESTAMPTZ '2021-12-23 21:56:39+05:30'
    ),
    (
        'Traditional Saree Portrait',
        'Graceful graphite study portraying traditional Indian attire with intricate polka saree motifs.',
        'PENCIL',
        '/paintings/Screenshot_20211223-215655__01.jpg',
        TIMESTAMPTZ '2021-12-23 21:56:55+05:30'
    ),
    (
        'Confident Gentleman Portrait',
        'Bold graphite pencil sketch of a gentleman with folded arms and striped polo shirt, highlighting realistic shading.',
        'PENCIL',
        '/paintings/Screenshot_20211223-215703__01.jpg',
        TIMESTAMPTZ '2021-03-12 12:00:00+05:30'
    ),

    -- CHARCOAL (Charcoal Portraits)
    (
        'Serene Woman in Black Saree',
        'Deep velvety charcoal portrait emphasizing rich shadows, embroidered pallu patterns, and meditative expression.',
        'CHARCOAL',
        '/paintings/PhotoGrid_1581055403972.jpg',
        TIMESTAMPTZ '2020-02-07 10:43:23+05:30'
    ),
    (
        'Girl in Summer Hat',
        'Expressive charcoal sketch with dark smudged background and vivid tonal depth on sun hat and smiling expression.',
        'CHARCOAL',
        '/paintings/PhotoGrid_1581056344798.jpg',
        TIMESTAMPTZ '2020-02-07 10:59:04+05:30'
    ),
    (
        'Thoughtful Gentleman Study',
        'Dramatic charcoal study depicting beard and spectacles with bold tonal contrast and smudged gradients.',
        'CHARCOAL',
        '/paintings/PhotoGrid_1581056549765.jpg',
        TIMESTAMPTZ '2020-02-07 11:02:29+05:30'
    ),
    (
        'Young Couple Duo in Charcoal',
        'Masterful willow and compressed charcoal portrait capturing a loving couple with crisp clothing text and realistic lighting.',
        'CHARCOAL',
        '/paintings/PhotoGrid_1581058556583.jpg',
        TIMESTAMPTZ '2019-11-26 18:00:00+05:30'
    ),
    (
        'Affectionate Couple Portrait',
        'Atmospheric charcoal drawing with nuanced tonal transitions and heartfelt warmth.',
        'CHARCOAL',
        '/paintings/PhotoGrid_1581059479847.jpg',
        TIMESTAMPTZ '2020-02-07 11:51:19+05:30'
    ),
    (
        'Contemporary Couple Portrait',
        'High-contrast charcoal piece rendering textures of patterned apparel, eyeglasses, and expressive eyes.',
        'CHARCOAL',
        '/paintings/PhotoGrid_1581222315784.jpg',
        TIMESTAMPTZ '2020-02-09 09:02:20+05:30'
    ),
    (
        'Romantic Evening Portrait',
        'Intense charcoal artwork capturing rich black fabric folds, henna tattoo details, and gentle companionship.',
        'CHARCOAL',
        '/paintings/PhotoGrid_1581278322620.jpg',
        TIMESTAMPTZ '2020-02-10 00:38:42+05:30'
    ),
    (
        'Playful Back-to-Back Couple',
        'Dynamic charcoal composition featuring textured clothing folds, smudged vignette background, and shared laughter.',
        'CHARCOAL',
        '/paintings/PhotoGrid_1581625154697.jpg',
        TIMESTAMPTZ '2020-02-14 01:00:00+05:30'
    ),
    (
        'Indira Gandhi Historical Tribute',
        'Historic charcoal and white chalk portrait of Prime Minister Indira Gandhi detailing the iconic saree and focused gaze.',
        'CHARCOAL',
        '/paintings/PhotoGrid_1590847935658.jpg',
        TIMESTAMPTZ '2020-04-29 18:00:00+05:30'
    ),

    -- WATERCOLOR (Watercolor Artwork)
    (
        'Pastel Toned Watercolor Portrait',
        'Luminous color portrait rendered with soft watercolor and gouache washes on textured cold-press paper with mint green background.',
        'WATERCOLOR',
        '/paintings/PhotoGrid_1581056422304.jpg',
        TIMESTAMPTZ '2020-02-07 11:00:22+05:30'
    ),

    -- ACRYLIC (Acrylic Paintings)
    (
        'Radiant Woman in Lime Green',
        'Vibrant acrylic portrait painted on primed canvas board with warm burnt sienna background and rich color blending.',
        'ACRYLIC',
        '/paintings/PhotoGrid_1581055639136.jpg',
        TIMESTAMPTZ '2019-05-31 18:00:00+05:30'
    ),
    (
        'Birds of Harmony on Sunrise Branch',
        'Vivid colorful acrylic canvas art featuring rainbow sunset sponge-dabbing, silhouette branches, and 3D sculpted clay birds and leaves.',
        'ACRYLIC',
        '/paintings/PhotoGrid_1581058790907.jpg',
        TIMESTAMPTZ '2020-02-07 11:39:50+05:30'
    ),

    -- OIL (Oil Paintings)
    (
        'Heirloom Oil Portrait on Stretched Canvas',
        'Classic oil on canvas portrait of a woman in emerald green against a serene azure sky, signed Ganesh Terkar.',
        'OIL',
        '/paintings/PhotoGrid_1581055541054.jpg',
        TIMESTAMPTZ '2020-02-07 10:45:41+05:30'
    )
) AS v(title, description, category, image_url, created_at)
WHERE NOT EXISTS (
    SELECT 1 FROM artist_paintings ap WHERE ap.image_url = v.image_url
);
