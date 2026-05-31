INSERT INTO sources (name, name_zh, author, year, type, level, status, description, sort_order) VALUES
('A Dictionary of the Swatow Dialect', '汕頭方言詞典', 'William Ashmore', '1883', 'scan_dict', 'S', 'public_domain', 'First comprehensive Swatow dialect dictionary', 1),
('A Swatow Index to the Syllabic Dictionary of Chinese', '汕頭音節字典索引', 'William Campbell', '1904', 'scan_dict', 'S', 'public_domain', 'Index to Rev. MacGillivray''s Syllabic Dictionary arranged by Swatow pronunciation', 2),
('English-Chinese Vocabulary of the Swatow Dialect', '汕頭方言英漢詞彙', 'Herbert Giles', '1877', 'scan_dict', 'A', 'public_domain', 'Early English-Chinese vocabulary for Swatow dialect', 3),
('潮汕方言詞典', '潮汕方言詞典', '林倫倫、陳暁楓', '現代', 'text_dict', 'A', 'pending', '現代潮汕方言詞典', 4),
('Primer of the Swatow Dialect', '汕頭方言入門', 'William Ashmore', '1883', 'scan_dict', 'B', 'public_domain', 'Introductory primer for learning Swatow dialect', 5);

INSERT INTO entries (source_id, hanzi, puj, dp, en, mandarin, ja, page_num, sort_order) VALUES
(1, '食', 'tsia̍h', 'ziah8', 'to eat; to take food; to consume', '吃', '食べる', 42, 1),
(1, '食飯', 'tsia̍h-pn̄g', 'ziah8-bng7', 'to eat a meal', '吃飯', 'ご飯を食べる', 42, 2),
(1, '食茶', 'tsia̍h-tê', 'ziah8-de5', 'to drink tea', '喝茶', 'お茶を飲む', 42, 3),
(2, '食', 'tsia̍h', 'ziah8', 'to eat', '吃', '食べる', 156, 1),
(2, '食飯', 'tsia̍h-pn̄g', 'ziah8-bng7', 'to eat rice', '吃飯', 'ご飯を食べる', 156, 2),
(3, '食', 'tsia̍h', 'ziah8', 'to eat; to drink', '吃', '食べる', 28, 1),
(3, '潮州', 'Tiê-tsiu', 'dio5-ziu1', 'Chaozhou (city/region)', '潮州', '潮州', 12, 1),
(4, '食', 'tsia̍h', 'ziah8', '吃', '吃', '食べる', NULL, 1),
(4, '食飯', 'tsia̍h-pn̄g', 'ziah8-bng7', '吃飯', '吃飯', 'ご飯を食べる', NULL, 2),
(5, '食', 'tsia̍h', 'ziah8', 'to eat', '吃', '食べる', 15, 1);

INSERT INTO examples (entry_id, teochew, puj, translation, sort_order) VALUES
(1, '我欲食飯', 'Úa àiⁿ tsia̍h-pn̄g', 'I want to eat a meal', 1),
(1, '食飽未？', 'Tsia̍h-pá--bōe?', 'Have you eaten?', 2);

INSERT INTO sections (source_id, title, sort_order) VALUES
(5, 'Lesson I - First Words', 1),
(5, 'Lesson II - Food and Drink', 2);
