// В записях «фамилия личное имя» фамилия не служит коротким именем героя.
const фамилии = new Map();
for (const ряд of [
  'ким kim gim 김', 'ли lee yi rhee 이', 'пак pak park bak 박', 'чхве чхой choi choe 최',
  'чон jeong jung chung 정', 'jeon 전', 'кан kang gang 강', 'чо cho jo 조',
  'юн yun yoon 윤', 'чан jang chang 장', 'им lim im rim 임', 'хан han 한',
  'о oh 오', 'со seo suh 서', 'син шин shin sin 신', 'квон kwon gwon 권',
  'хван hwang 황', 'ан ahn an 안', 'сон song 송', 'рю ryu 류',
  'хон hong 홍', 'ко go koh 고', 'мун moon mun 문', 'ян yang 양', 'сонг',
  'пэ bae 배', 'пэк baek paik 백', 'хо heo 허', 'нам nam 남', 'сим shim sim 심',
  'мин min 민', 'у woo 우', 'ю yoo yu 유', 'ён yeon 연', 'ом eom 엄', 'тхэ tae 태', 'ван wang 왕', 'пён byeon 변', 'сок seok 석', 'чин jin 진', 'чу ju 주', 'квак kwak gwak 곽', 'ёнг yeong 영', 'сён seong 성',
  'но noh roh 노', 'ха ha 하', 'ма ma 마', 'ча cha 차', 'ку koo gu 구',
]) {
  const слова = ряд.split(' ');
  for (const слово of слова) фамилии.set(слово, слова[0]);
}

export function корейскаяФамилия(имя) {
  const первое = String(имя || '').trim().toLowerCase().split(/\s+/, 1)[0];
  return фамилии.get(первое) || '';
}
