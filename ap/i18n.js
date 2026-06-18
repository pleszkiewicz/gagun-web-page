window.AP_LANGUAGES = [
  { code: "pl", label: "PL", flag: "🇵🇱" },
  { code: "en", label: "EN", flag: "🇬🇧" },
];

window.AP_MESSAGES = {
  pl: {
    meta: {
      title: "Kancelaria Radcy Prawnego Aleksandra Pełszyńska",
      description:
        "Kancelaria Radcy Prawnego Aleksandra Pełszyńska w Ełku. Pomoc prawna dla osób fizycznych, przedsiębiorców i jednostek samorządu terytorialnego.",
    },
    accessibility: {
      skipLink: "Przejdź do treści",
    },
    brand: {
      ariaLabel: "Kancelaria Radcy Prawnego Aleksandra Pełszyńska",
      name: "Aleksandra Pełszyńska",
      role: "radca prawny",
    },
    navigation: {
      ariaLabel: "Nawigacja strony kancelarii",
      sectionsLabel: "Sekcje strony",
      about: "O mnie",
      office: "Kancelaria",
      services: "Oferta",
      contact: "Kontakt",
    },
    language: {
      ariaLabel: "Wybór języka",
    },
    hero: {
      eyebrow: "Kancelaria Radcy Prawnego w Ełku",
      title: "Pomoc prawna prowadzona jasno, rzetelnie i z pełną dyskrecją.",
      lead:
        "Kancelaria wspiera osoby fizyczne, przedsiębiorców oraz jednostki samorządu terytorialnego w sprawach wymagających spokojnej analizy i skutecznego działania.",
      actionsLabel: "Szybki kontakt",
      callAction: "Zadzwoń: +48 507 273 689",
      emailAction: "Napisz e-mail",
      panelLabel: "Informacje kontaktowe",
    },
    about: {
      eyebrow: "O mnie",
      title: "Aleksandra Pełszyńska",
      photoAlt: "Aleksandra Pełszyńska w kancelarii",
      p1:
        "Ukończyłam Uniwersytet Warmińsko-Mazurski w Olsztynie na kierunku prawo. Po zakończeniu studiów odbyłam aplikację radcowską prowadzoną przez Okręgową Izbę Radców Prawnych w Białymstoku, zwieńczoną egzaminem radcowskim.",
      p2:
        "Doświadczenie zdobywałam między innymi podczas stażu w Urzędzie Gminy w Ełku, praktyk w Zespole Radców Prawnych w Starostwie Powiatowym w Ełku oraz współpracy z innymi radcami prawnymi.",
      p3:
        "Po zdaniu egzaminu zawodowego otworzyłam własną kancelarię, łącząc wiedzę praktyczną z indywidualnym podejściem do każdej sprawy.",
    },
    office: {
      eyebrow: "Kancelaria",
      title: "Współpraca stała i doraźna",
      intro:
        "Kancelaria świadczy pomoc prawną na rzecz osób fizycznych, przedsiębiorców oraz jednostek samorządu terytorialnego.",
      values: {
        professional: "Profesjonalne i staranne podejście do każdego zlecenia.",
        communication: "Bieżące informowanie klienta o podejmowanych działaniach.",
        discretion: "Uczciwość, kompleksowość usług i dyskrecja.",
        kindness: "Życzliwe podejście do klienta.",
        ethics: "Zachowanie wymagań etycznych zawodu radcy prawnego.",
      },
    },
    services: {
      eyebrow: "Oferta",
      title: "Zakres pomocy prawnej",
      intro:
        "Kancelaria zapewnia kompleksową i incydentalną obsługę prawną, dostosowaną do charakteru sprawy.",
      areas: {
        family: {
          title: "Prawo rodzinne",
          text:
            "Rozwód, alimenty, podział majątku i sprawy rodzinne wymagające reprezentacji lub konsultacji.",
        },
        inheritance: {
          title: "Prawo spadkowe",
          text: "Stwierdzenie nabycia spadku, dział spadku, zachowek i inne sprawy spadkowe.",
        },
        civil: {
          title: "Prawo cywilne",
          text: "Sprawy o zapłatę, odszkodowanie, przygotowanie pism i analiza sytuacji prawnej.",
        },
        work: {
          title: "Prawo pracy",
          text: "Sprawy dotyczące stosunku pracy, konsultacje oraz reprezentacja w sporach.",
        },
        admin: {
          title: "Prawo administracyjne i ZUS",
          text:
            "Postępowania administracyjne, odwołania od decyzji ZUS oraz sprawy rent i emerytur.",
        },
        criminal: {
          title: "Prawo karne",
          text:
            "Pomoc w sprawach karnych oraz występowanie przed sądami jako obrońca lub pełnomocnik.",
        },
      },
      helpTitle: "Pomoc prawna obejmuje w szczególności",
      help: {
        consultations: "porady i konsultacje prawne",
        opinions: "opinie prawne i pisma procesowe",
        acts: "projekty aktów prawnych",
        representation: "reprezentację przed urzędami i sądami",
      },
    },
    contact: {
      eyebrow: "Kontakt",
      title: "Umów konsultację",
      intro:
        "Kancelaria mieści się przy ul. Mickiewicza 17 lok. 4 w Ełku. Wjazd na parking znajduje się od ulicy Konopnickiej.",
      phoneDisplay: "+48 507 273 689",
      address: "ul. Mickiewicza 17 lok. 4, I piętro, Ełk",
      hoursShort: "Poniedziałek - piątek, 08:00-15:00",
      hoursMain: "Poniedziałek - piątek, 08:00-15:00.",
      hoursNote: "Spotkania popołudniowe po wcześniejszym kontakcie.",
      labels: {
        phone: "Telefon",
        email: "E-mail",
        address: "Adres",
        hours: "Godziny",
      },
    },
    map: {
      openButton: "Mapa",
      openLabel: "Otwórz adres w Google Maps",
    },
    form: {
      configTitle: "Formularz wymaga konfiguracji.",
      configText: "Wklej endpoint Formspree w pliku ap/config.js, aby uruchomić wysyłkę wiadomości.",
      nameLabel: "Imię i nazwisko",
      emailLabel: "Adres e-mail",
      messageLabel: "Treść wiadomości",
      privacyPrefix: "Potwierdzam zapoznanie się z",
      privacyLink: "informacją o przetwarzaniu danych osobowych",
      privacySuffix: ".",
      privacyInfoLabel: "Pokaż informację o przetwarzaniu danych osobowych",
      submit: "Wyślij wiadomość",
      sending: "Wysyłanie wiadomości...",
      success: "Dziękuję. Wiadomość została wysłana.",
      error: "Nie udało się wysłać wiadomości. Spróbuj ponownie lub napisz e-mail bezpośrednio.",
      validation: "Uzupełnij wymagane pola i zaakceptuj informację o przetwarzaniu danych.",
      notConfigured: "Formularz nie jest jeszcze skonfigurowany. Skorzystaj z telefonu lub e-maila.",
    },
    privacy: {
      title: "Informacja o przetwarzaniu danych osobowych",
      p1:
        "Administratorem danych osobowych przekazanych przez formularz kontaktowy jest Kancelaria Radcy Prawnego Aleksandra Pełszyńska, ul. Mickiewicza 17 lok. 4, 19-300 Ełk.",
      p2:
        "Dane są przetwarzane w celu udzielenia odpowiedzi na wiadomość i prowadzenia korespondencji. Podstawą przetwarzania jest prawnie uzasadniony interes administratora albo działania poprzedzające zawarcie umowy, jeżeli kontakt dotyczy zlecenia pomocy prawnej.",
      p3:
        "Odbiorcą danych może być Formspree, dostawca obsługi formularza kontaktowego. Dane będą przechowywane przez okres niezbędny do obsługi zapytania, a następnie przez okres wymagany przepisami prawa lub uzasadniony ochroną roszczeń.",
      p4:
        "Osobie, której dane dotyczą, przysługuje prawo dostępu do danych, sprostowania, usunięcia, ograniczenia przetwarzania, sprzeciwu oraz wniesienia skargi do Prezesa UODO. Podanie danych jest dobrowolne, ale niezbędne do otrzymania odpowiedzi.",
      note: "Treść klauzuli powinna zostać ostatecznie zatwierdzona przez właścicielkę kancelarii przed publikacją.",
      close: "Zamknij",
    },
    footer: {
      copy: "© Kancelaria Radcy Prawnego Aleksandra Pełszyńska",
      backToTop: "Powrót na górę",
    },
  },
  en: {
    meta: {
      title: "Legal Counsel Office Aleksandra Pełszyńska",
      description:
        "Legal Counsel Office Aleksandra Pełszyńska in Ełk. Legal support for individuals, businesses and local government entities.",
    },
    accessibility: {
      skipLink: "Skip to content",
    },
    brand: {
      ariaLabel: "Legal Counsel Office Aleksandra Pełszyńska",
      name: "Aleksandra Pełszyńska",
      role: "legal counsel",
    },
    navigation: {
      ariaLabel: "Office website navigation",
      sectionsLabel: "Page sections",
      about: "About",
      office: "Office",
      services: "Services",
      contact: "Contact",
    },
    language: {
      ariaLabel: "Language selector",
    },
    hero: {
      eyebrow: "Legal Counsel Office in Ełk",
      title: "Legal support delivered clearly, reliably and with full discretion.",
      lead:
        "The office supports individuals, businesses and local government entities in matters that require calm analysis and effective action.",
      actionsLabel: "Quick contact",
      callAction: "Call: +48 507 273 689",
      emailAction: "Send an email",
      panelLabel: "Contact information",
    },
    about: {
      eyebrow: "About",
      title: "Aleksandra Pełszyńska",
      photoAlt: "Aleksandra Pełszyńska at the office",
      p1:
        "I graduated in law from the University of Warmia and Mazury in Olsztyn. After completing my studies, I completed legal counsel training with the Regional Chamber of Legal Counsels in Białystok and passed the professional legal counsel examination.",
      p2:
        "I gained experience during an internship at the Ełk Municipal Office, volunteer practice with the legal counsel team at the Ełk County Office, and by working with other legal counsels.",
      p3:
        "After passing the professional exam, I opened my own office, combining practical legal knowledge with an individual approach to every matter.",
    },
    office: {
      eyebrow: "Office",
      title: "Ongoing and ad hoc cooperation",
      intro:
        "The office provides legal assistance to individuals, businesses and local government entities.",
      values: {
        professional: "Professional and careful handling of every matter.",
        communication: "Keeping clients informed about actions taken.",
        discretion: "Integrity, comprehensive service and discretion.",
        kindness: "A considerate approach to clients.",
        ethics: "Compliance with the ethical standards of the legal counsel profession.",
      },
    },
    services: {
      eyebrow: "Services",
      title: "Scope of legal assistance",
      intro:
        "The office provides comprehensive and ad hoc legal services adjusted to the nature of the matter.",
      areas: {
        family: {
          title: "Family law",
          text:
            "Divorce, maintenance, division of property and family matters requiring representation or consultation.",
        },
        inheritance: {
          title: "Inheritance law",
          text: "Confirmation of inheritance acquisition, estate division, legitime and related matters.",
        },
        civil: {
          title: "Civil law",
          text: "Payment claims, compensation cases, drafting legal letters and legal analysis.",
        },
        work: {
          title: "Labour law",
          text: "Employment relationship matters, consultations and representation in disputes.",
        },
        admin: {
          title: "Administrative law and social insurance",
          text:
            "Administrative proceedings, appeals against ZUS decisions and pension or disability benefit matters.",
        },
        criminal: {
          title: "Criminal law",
          text:
            "Assistance in criminal cases and representation before courts as defence counsel or attorney.",
        },
      },
      helpTitle: "Legal assistance includes in particular",
      help: {
        consultations: "legal advice and consultations",
        opinions: "legal opinions and procedural letters",
        acts: "draft legal acts",
        representation: "representation before offices and courts",
      },
    },
    contact: {
      eyebrow: "Contact",
      title: "Book a consultation",
      intro:
        "The office is located at 17 Mickiewicza Street, suite 4, in Ełk. Parking access is from Konopnickiej Street.",
      phoneDisplay: "+48 507 273 689",
      address: "17 Mickiewicza Street, suite 4, 1st floor, Ełk",
      hoursShort: "Monday - Friday, 08:00-15:00",
      hoursMain: "Monday - Friday, 08:00-15:00.",
      hoursNote: "Afternoon meetings by prior arrangement.",
      labels: {
        phone: "Phone",
        email: "Email",
        address: "Address",
        hours: "Hours",
      },
    },
    map: {
      openButton: "Map",
      openLabel: "Open the address in Google Maps",
    },
    form: {
      configTitle: "The form needs configuration.",
      configText: "Paste the Formspree endpoint into ap/config.js to enable message sending.",
      nameLabel: "Full name",
      emailLabel: "Email address",
      messageLabel: "Message",
      privacyPrefix: "I confirm that I have read the",
      privacyLink: "personal data processing information",
      privacySuffix: ".",
      privacyInfoLabel: "Show the personal data processing information",
      submit: "Send message",
      sending: "Sending message...",
      success: "Thank you. The message has been sent.",
      error: "The message could not be sent. Please try again or email the office directly.",
      validation: "Complete the required fields and accept the personal data processing information.",
      notConfigured: "The form is not configured yet. Please use phone or email contact.",
    },
    privacy: {
      title: "Personal data processing information",
      p1:
        "The controller of personal data submitted through the contact form is Legal Counsel Office Aleksandra Pełszyńska, ul. Mickiewicza 17 lok. 4, 19-300 Ełk, Poland.",
      p2:
        "The data is processed to answer the message and conduct correspondence. The legal basis is the controller's legitimate interest or steps prior to entering into a contract if the inquiry concerns legal assistance.",
      p3:
        "The data may be received by Formspree, the contact form service provider. Data will be stored for the time necessary to handle the inquiry and then for the period required by law or justified by the protection of claims.",
      p4:
        "The data subject has the right to access, rectify, erase, restrict processing, object to processing and lodge a complaint with the Polish Data Protection Authority. Providing data is voluntary but necessary to receive a reply.",
      note: "The final wording should be approved by the owner of the office before publication.",
      close: "Close",
    },
    footer: {
      copy: "© Legal Counsel Office Aleksandra Pełszyńska",
      backToTop: "Back to top",
    },
  },
};
