// Starter list of well-known Indian colleges (added once on first start, see server/db.js).
// "Tier" is only a rough grouping to help students find their college; it is not an official ranking.
// Format: [name, city, state, description, website domain or null]
// The super admin can edit, delete or add colleges in Admin Panel > Colleges. Deleted ones do not come back.
const T1 = 'Tier 1';
const T2 = 'Tier 2';

export const STARTER_COLLEGES = [
  // ---- IITs ----
  ['IIT Bombay', 'Mumbai', 'Maharashtra', `${T1} · Indian Institute of Technology Bombay`, 'iitb.ac.in'],
  ['IIT Delhi', 'New Delhi', 'Delhi', `${T1} · Indian Institute of Technology Delhi`, 'iitd.ac.in'],
  ['IIT Kanpur', 'Kanpur', 'Uttar Pradesh', `${T1} · Indian Institute of Technology Kanpur`, 'iitk.ac.in'],
  ['IIT Madras', 'Chennai', 'Tamil Nadu', `${T1} · Indian Institute of Technology Madras`, 'iitm.ac.in'],
  ['IIT Kharagpur', 'Kharagpur', 'West Bengal', `${T1} · Indian Institute of Technology Kharagpur`, 'iitkgp.ac.in'],
  ['IIT Roorkee', 'Roorkee', 'Uttarakhand', `${T1} · Indian Institute of Technology Roorkee`, 'iitr.ac.in'],
  ['IIT Guwahati', 'Guwahati', 'Assam', `${T1} · Indian Institute of Technology Guwahati`, 'iitg.ac.in'],
  ['IIT Hyderabad', 'Hyderabad', 'Telangana', `${T1} · Indian Institute of Technology Hyderabad`, 'iith.ac.in'],
  ['IIT (BHU) Varanasi', 'Varanasi', 'Uttar Pradesh', `${T1} · Indian Institute of Technology (BHU) Varanasi`, 'iitbhu.ac.in'],
  ['IIT (ISM) Dhanbad', 'Dhanbad', 'Jharkhand', `${T1} · Indian Institute of Technology (Indian School of Mines) Dhanbad`, 'iitism.ac.in'],
  ['IIT Indore', 'Indore', 'Madhya Pradesh', `${T1} · Indian Institute of Technology Indore`, 'iiti.ac.in'],
  ['IIT Ropar', 'Rupnagar', 'Punjab', `${T2} · Indian Institute of Technology Ropar`, 'iitrpr.ac.in'],
  ['IIT Bhubaneswar', 'Bhubaneswar', 'Odisha', `${T2} · Indian Institute of Technology Bhubaneswar`, 'iitbbs.ac.in'],
  ['IIT Gandhinagar', 'Gandhinagar', 'Gujarat', `${T2} · Indian Institute of Technology Gandhinagar`, 'iitgn.ac.in'],
  ['IIT Jodhpur', 'Jodhpur', 'Rajasthan', `${T2} · Indian Institute of Technology Jodhpur`, 'iitj.ac.in'],
  ['IIT Patna', 'Patna', 'Bihar', `${T2} · Indian Institute of Technology Patna`, 'iitp.ac.in'],
  ['IIT Mandi', 'Mandi', 'Himachal Pradesh', `${T2} · Indian Institute of Technology Mandi`, 'iitmandi.ac.in'],
  ['IIT Tirupati', 'Tirupati', 'Andhra Pradesh', `${T2} · Indian Institute of Technology Tirupati`, 'iittp.ac.in'],
  ['IIT Palakkad', 'Palakkad', 'Kerala', `${T2} · Indian Institute of Technology Palakkad`, 'iitpkd.ac.in'],
  ['IIT Bhilai', 'Bhilai', 'Chhattisgarh', `${T2} · Indian Institute of Technology Bhilai`, 'iitbhilai.ac.in'],
  ['IIT Goa', 'Farmagudi', 'Goa', `${T2} · Indian Institute of Technology Goa`, 'iitgoa.ac.in'],
  ['IIT Jammu', 'Jammu', 'Jammu and Kashmir', `${T2} · Indian Institute of Technology Jammu`, 'iitjammu.ac.in'],
  ['IIT Dharwad', 'Dharwad', 'Karnataka', `${T2} · Indian Institute of Technology Dharwad`, 'iitdh.ac.in'],

  // ---- science, research and technology institutes ----
  ['IISc Bangalore', 'Bengaluru', 'Karnataka', `${T1} · Indian Institute of Science`, 'iisc.ac.in'],
  ['IISER Pune', 'Pune', 'Maharashtra', `${T1} · Indian Institute of Science Education and Research Pune`, 'iiserpune.ac.in'],
  ['IISER Kolkata', 'Mohanpur', 'West Bengal', `${T1} · Indian Institute of Science Education and Research Kolkata`, 'iiserkol.ac.in'],
  ['IISER Mohali', 'Mohali', 'Punjab', `${T1} · Indian Institute of Science Education and Research Mohali`, 'iisermohali.ac.in'],
  ['IISER Bhopal', 'Bhopal', 'Madhya Pradesh', `${T2} · Indian Institute of Science Education and Research Bhopal`, 'iiserb.ac.in'],
  ['IISER Thiruvananthapuram', 'Thiruvananthapuram', 'Kerala', `${T2} · Indian Institute of Science Education and Research Thiruvananthapuram`, 'iisertvm.ac.in'],
  ['NISER Bhubaneswar', 'Bhubaneswar', 'Odisha', `${T1} · National Institute of Science Education and Research`, 'niser.ac.in'],
  ['Chennai Mathematical Institute', 'Chennai', 'Tamil Nadu', `${T1} · Mathematics, computer science and physics`, 'cmi.ac.in'],
  ['Indian Statistical Institute Kolkata', 'Kolkata', 'West Bengal', `${T1} · Statistics, mathematics and computer science`, 'isical.ac.in'],
  ['IIST Thiruvananthapuram', 'Thiruvananthapuram', 'Kerala', `${T1} · Indian Institute of Space Science and Technology`, 'iist.ac.in'],
  ['BITS Pilani', 'Pilani', 'Rajasthan', `${T1} · Birla Institute of Technology and Science, Pilani campus`, 'bits-pilani.ac.in'],
  ['BITS Pilani, Goa Campus', 'Goa', 'Goa', `${T1} · Birla Institute of Technology and Science, Goa campus`, 'goa.bits-pilani.ac.in'],
  ['BITS Pilani, Hyderabad Campus', 'Hyderabad', 'Telangana', `${T1} · Birla Institute of Technology and Science, Hyderabad campus`, 'hyderabad.bits-pilani.ac.in'],

  // ---- IIITs ----
  ['IIIT Hyderabad', 'Hyderabad', 'Telangana', `${T1} · International Institute of Information Technology Hyderabad`, 'iiit.ac.in'],
  ['IIIT Delhi', 'New Delhi', 'Delhi', `${T1} · Indraprastha Institute of Information Technology Delhi`, 'iiitd.ac.in'],
  ['IIIT Bangalore', 'Bengaluru', 'Karnataka', `${T1} · International Institute of Information Technology Bangalore`, 'iiitb.ac.in'],
  ['IIIT Allahabad', 'Prayagraj', 'Uttar Pradesh', `${T2} · Indian Institute of Information Technology Allahabad`, 'iiita.ac.in'],
  ['IIITM Gwalior', 'Gwalior', 'Madhya Pradesh', `${T2} · ABV-Indian Institute of Information Technology and Management Gwalior`, 'iiitm.ac.in'],
  ['IIITDM Jabalpur', 'Jabalpur', 'Madhya Pradesh', `${T2} · Indian Institute of Information Technology, Design and Manufacturing Jabalpur`, 'iiitdmj.ac.in'],
  ['IIITDM Kancheepuram', 'Chennai', 'Tamil Nadu', `${T2} · Indian Institute of Information Technology, Design and Manufacturing Kancheepuram`, 'iiitdm.ac.in'],

  // ---- NITs ----
  ['NIT Tiruchirappalli', 'Tiruchirappalli', 'Tamil Nadu', `${T1} · National Institute of Technology Tiruchirappalli`, 'nitt.edu'],
  ['NIT Karnataka, Surathkal', 'Mangaluru', 'Karnataka', `${T1} · National Institute of Technology Karnataka`, 'nitk.ac.in'],
  ['NIT Warangal', 'Warangal', 'Telangana', `${T1} · National Institute of Technology Warangal`, 'nitw.ac.in'],
  ['NIT Rourkela', 'Rourkela', 'Odisha', `${T1} · National Institute of Technology Rourkela`, 'nitrkl.ac.in'],
  ['NIT Calicut', 'Kozhikode', 'Kerala', `${T1} · National Institute of Technology Calicut`, 'nitc.ac.in'],
  ['MNNIT Allahabad', 'Prayagraj', 'Uttar Pradesh', `${T1} · Motilal Nehru National Institute of Technology`, 'mnnit.ac.in'],
  ['MNIT Jaipur', 'Jaipur', 'Rajasthan', `${T1} · Malaviya National Institute of Technology`, 'mnit.ac.in'],
  ['VNIT Nagpur', 'Nagpur', 'Maharashtra', `${T1} · Visvesvaraya National Institute of Technology`, 'vnit.ac.in'],
  ['MANIT Bhopal', 'Bhopal', 'Madhya Pradesh', `${T2} · Maulana Azad National Institute of Technology`, 'manit.ac.in'],
  ['SVNIT Surat', 'Surat', 'Gujarat', `${T2} · Sardar Vallabhbhai National Institute of Technology`, 'svnit.ac.in'],
  ['NIT Durgapur', 'Durgapur', 'West Bengal', `${T2} · National Institute of Technology Durgapur`, 'nitdgp.ac.in'],
  ['NIT Kurukshetra', 'Kurukshetra', 'Haryana', `${T2} · National Institute of Technology Kurukshetra`, 'nitkkr.ac.in'],
  ['NIT Delhi', 'New Delhi', 'Delhi', `${T2} · National Institute of Technology Delhi`, 'nitdelhi.ac.in'],
  ['NIT Hamirpur', 'Hamirpur', 'Himachal Pradesh', `${T2} · National Institute of Technology Hamirpur`, 'nith.ac.in'],
  ['NIT Jamshedpur', 'Jamshedpur', 'Jharkhand', `${T2} · National Institute of Technology Jamshedpur`, 'nitjsr.ac.in'],
  ['NIT Silchar', 'Silchar', 'Assam', `${T2} · National Institute of Technology Silchar`, 'nits.ac.in'],
  ['NIT Patna', 'Patna', 'Bihar', `${T2} · National Institute of Technology Patna`, 'nitp.ac.in'],
  ['NIT Raipur', 'Raipur', 'Chhattisgarh', `${T2} · National Institute of Technology Raipur`, 'nitrr.ac.in'],
  ['NIT Goa', 'Farmagudi', 'Goa', `${T2} · National Institute of Technology Goa`, 'nitgoa.ac.in'],
  ['NIT Srinagar', 'Srinagar', 'Jammu and Kashmir', `${T2} · National Institute of Technology Srinagar`, 'nitsri.ac.in'],
  ['NIT Agartala', 'Agartala', 'Tripura', `${T2} · National Institute of Technology Agartala`, 'nita.ac.in'],

  // ---- other leading engineering colleges and technical universities ----
  ['Delhi Technological University', 'New Delhi', 'Delhi', `${T1} · DTU, engineering and technology`, 'dtu.ac.in'],
  ['Netaji Subhas University of Technology', 'New Delhi', 'Delhi', `${T1} · NSUT, engineering and technology`, 'nsut.ac.in'],
  ['Jadavpur University', 'Kolkata', 'West Bengal', `${T1} · Engineering, arts and science`, 'jaduniv.edu.in'],
  ['College of Engineering Guindy (Anna University)', 'Chennai', 'Tamil Nadu', `${T1} · CEG, Anna University`, 'annauniv.edu'],
  ['COEP Technological University', 'Pune', 'Maharashtra', `${T1} · Formerly College of Engineering Pune`, null],
  ['VJTI Mumbai', 'Mumbai', 'Maharashtra', `${T1} · Veermata Jijabai Technological Institute`, 'vjti.ac.in'],
  ['Institute of Chemical Technology Mumbai', 'Mumbai', 'Maharashtra', `${T1} · ICT, chemical and pharmaceutical sciences`, null],
  ['IIEST Shibpur', 'Howrah', 'West Bengal', `${T2} · Indian Institute of Engineering Science and Technology`, 'iiests.ac.in'],
  ['Indira Gandhi Delhi Technical University for Women', 'New Delhi', 'Delhi', `${T2} · IGDTUW`, 'igdtuw.ac.in'],
  ['Punjab Engineering College', 'Chandigarh', 'Chandigarh', `${T2} · PEC, deemed university`, 'pec.ac.in'],
  ['Osmania University', 'Hyderabad', 'Telangana', `${T2} · Engineering, arts and science`, 'osmania.ac.in'],
  ['Andhra University', 'Visakhapatnam', 'Andhra Pradesh', `${T2} · Engineering, arts and science`, 'andhrauniversity.edu.in'],
  ['BIT Mesra', 'Ranchi', 'Jharkhand', `${T2} · Birla Institute of Technology, Mesra`, 'bitmesra.ac.in'],
  ['Thapar Institute of Engineering and Technology', 'Patiala', 'Punjab', `${T2} · Engineering and management`, 'thapar.edu'],
  ['DA-IICT Gandhinagar', 'Gandhinagar', 'Gujarat', `${T2} · Dhirubhai Ambani Institute of Information and Communication Technology`, 'daiict.ac.in'],
  ['LNMIIT Jaipur', 'Jaipur', 'Rajasthan', `${T2} · The LNM Institute of Information Technology`, 'lnmiit.ac.in'],
  ['Jaypee Institute of Information Technology', 'Noida', 'Uttar Pradesh', `${T2} · JIIT, engineering`, 'jiit.ac.in'],
  ['Nirma University', 'Ahmedabad', 'Gujarat', `${T2} · Engineering, management and pharmacy`, 'nirmauni.ac.in'],
  ['Pandit Deendayal Energy University', 'Gandhinagar', 'Gujarat', `${T2} · PDEU, energy and technology`, null],

  // ---- leading private universities ----
  ['VIT Vellore', 'Vellore', 'Tamil Nadu', `${T2} · Vellore Institute of Technology`, 'vit.ac.in'],
  ['SRM Institute of Science and Technology', 'Chennai', 'Tamil Nadu', `${T2} · SRMIST, Kattankulathur`, 'srmist.edu.in'],
  ['Manipal Institute of Technology', 'Manipal', 'Karnataka', `${T2} · MIT, Manipal Academy of Higher Education`, 'manipal.edu'],
  ['PES University', 'Bengaluru', 'Karnataka', `${T2} · Engineering, management and design`, 'pes.edu'],
  ['RV College of Engineering', 'Bengaluru', 'Karnataka', `${T2} · RVCE`, 'rvce.edu.in'],
  ['BMS College of Engineering', 'Bengaluru', 'Karnataka', `${T2} · BMSCE`, 'bmsce.ac.in'],
  ['M.S. Ramaiah Institute of Technology', 'Bengaluru', 'Karnataka', `${T2} · MSRIT`, 'msrit.edu'],
  ['Amrita Vishwa Vidyapeetham, Coimbatore', 'Coimbatore', 'Tamil Nadu', `${T2} · Engineering and sciences`, 'amrita.edu'],
  ['SASTRA Deemed University', 'Thanjavur', 'Tamil Nadu', `${T2} · Engineering, law and sciences`, 'sastra.edu'],
  ['PSG College of Technology', 'Coimbatore', 'Tamil Nadu', `${T2} · PSG Tech`, 'psgtech.edu'],
  ['Thiagarajar College of Engineering', 'Madurai', 'Tamil Nadu', `${T2} · TCE`, 'tce.edu'],
  ['KIIT University', 'Bhubaneswar', 'Odisha', `${T2} · Kalinga Institute of Industrial Technology`, 'kiit.ac.in'],
  ['Shiv Nadar University', 'Greater Noida', 'Uttar Pradesh', `${T2} · Engineering, sciences and humanities`, 'snu.edu.in'],
  ['Symbiosis International University', 'Pune', 'Maharashtra', `${T2} · Law, management, media and more`, 'siu.edu.in'],
  ['Christ University', 'Bengaluru', 'Karnataka', `${T2} · Arts, commerce, science and management`, 'christuniversity.in'],
  ['Ashoka University', 'Sonipat', 'Haryana', `${T2} · Liberal arts`, 'ashoka.edu.in'],
  ['O.P. Jindal Global University', 'Sonipat', 'Haryana', `${T2} · Law, business and public policy`, 'jgu.edu.in'],

  // ---- central and state universities ----
  ['University of Delhi', 'New Delhi', 'Delhi', `${T1} · Central university`, 'du.ac.in'],
  ['Jawaharlal Nehru University', 'New Delhi', 'Delhi', `${T1} · Central university`, 'jnu.ac.in'],
  ['Jamia Millia Islamia', 'New Delhi', 'Delhi', `${T1} · Central university`, 'jmi.ac.in'],
  ['Banaras Hindu University', 'Varanasi', 'Uttar Pradesh', `${T1} · Central university`, 'bhu.ac.in'],
  ['Aligarh Muslim University', 'Aligarh', 'Uttar Pradesh', `${T1} · Central university`, 'amu.ac.in'],
  ['University of Hyderabad', 'Hyderabad', 'Telangana', `${T1} · Central university`, 'uohyd.ac.in'],
  ['Presidency University Kolkata', 'Kolkata', 'West Bengal', `${T1} · Arts and sciences`, 'presiuniv.ac.in'],
  ['University of Calcutta', 'Kolkata', 'West Bengal', `${T2} · State university`, 'caluniv.ac.in'],
  ['University of Mumbai', 'Mumbai', 'Maharashtra', `${T2} · State university`, 'mu.ac.in'],
  ['Savitribai Phule Pune University', 'Pune', 'Maharashtra', `${T2} · State university`, 'unipune.ac.in'],
  ['Panjab University', 'Chandigarh', 'Chandigarh', `${T2} · State university`, 'puchd.ac.in'],

  // ---- well-known arts, science and commerce colleges ----
  ["St. Stephen's College", 'New Delhi', 'Delhi', `${T1} · University of Delhi`, 'ststephens.edu'],
  ['Hindu College', 'New Delhi', 'Delhi', `${T1} · University of Delhi`, null],
  ['Shri Ram College of Commerce', 'New Delhi', 'Delhi', `${T1} · University of Delhi`, 'srcc.edu'],
  ['Miranda House', 'New Delhi', 'Delhi', `${T1} · University of Delhi`, 'mirandahouse.ac.in'],
  ['Lady Shri Ram College for Women', 'New Delhi', 'Delhi', `${T1} · University of Delhi`, 'lsr.edu.in'],
  ['Hansraj College', 'New Delhi', 'Delhi', `${T1} · University of Delhi`, null],
  ['Kirori Mal College', 'New Delhi', 'Delhi', `${T2} · University of Delhi`, null],
  ['Ramjas College', 'New Delhi', 'Delhi', `${T2} · University of Delhi`, null],
  ['Sri Venkateswara College', 'New Delhi', 'Delhi', `${T2} · University of Delhi`, null],
  ["St. Xavier's College Mumbai", 'Mumbai', 'Maharashtra', `${T1} · Arts, science and commerce`, 'xaviers.edu'],
  ["St. Xavier's College Kolkata", 'Kolkata', 'West Bengal', `${T1} · Arts, science and commerce`, 'sxccal.edu'],
  ['Loyola College Chennai', 'Chennai', 'Tamil Nadu', `${T1} · Arts, science and commerce`, 'loyolacollege.edu'],
  ['Madras Christian College', 'Chennai', 'Tamil Nadu', `${T1} · Arts and science`, 'mcc.edu.in'],
  ['Fergusson College', 'Pune', 'Maharashtra', `${T2} · Arts, science and commerce`, 'fergusson.edu'],

  // ---- management ----
  ['IIM Ahmedabad', 'Ahmedabad', 'Gujarat', `${T1} · Indian Institute of Management Ahmedabad`, 'iima.ac.in'],
  ['IIM Bangalore', 'Bengaluru', 'Karnataka', `${T1} · Indian Institute of Management Bangalore`, 'iimb.ac.in'],
  ['IIM Calcutta', 'Kolkata', 'West Bengal', `${T1} · Indian Institute of Management Calcutta`, 'iimcal.ac.in'],
  ['IIM Lucknow', 'Lucknow', 'Uttar Pradesh', `${T1} · Indian Institute of Management Lucknow`, 'iiml.ac.in'],
  ['IIM Kozhikode', 'Kozhikode', 'Kerala', `${T1} · Indian Institute of Management Kozhikode`, 'iimk.ac.in'],
  ['IIM Indore', 'Indore', 'Madhya Pradesh', `${T1} · Indian Institute of Management Indore`, 'iimidr.ac.in'],
  ['Indian School of Business', 'Hyderabad', 'Telangana', `${T1} · ISB, management`, 'isb.edu'],
  ['XLRI Jamshedpur', 'Jamshedpur', 'Jharkhand', `${T1} · Xavier School of Management`, 'xlri.ac.in'],
  ['Faculty of Management Studies, University of Delhi', 'New Delhi', 'Delhi', `${T1} · FMS Delhi`, 'fms.edu'],
  ['SPJIMR Mumbai', 'Mumbai', 'Maharashtra', `${T1} · S.P. Jain Institute of Management and Research`, 'spjimr.org'],
  ['Management Development Institute Gurgaon', 'Gurugram', 'Haryana', `${T2} · MDI`, 'mdi.ac.in'],
  ['IIFT Delhi', 'New Delhi', 'Delhi', `${T2} · Indian Institute of Foreign Trade`, 'iift.ac.in'],

  // ---- medical ----
  ['AIIMS New Delhi', 'New Delhi', 'Delhi', `${T1} · All India Institute of Medical Sciences`, 'aiims.edu'],
  ['JIPMER Puducherry', 'Puducherry', 'Puducherry', `${T1} · Jawaharlal Institute of Postgraduate Medical Education and Research`, 'jipmer.edu.in'],
  ['PGIMER Chandigarh', 'Chandigarh', 'Chandigarh', `${T1} · Postgraduate Institute of Medical Education and Research`, 'pgimer.edu.in'],
  ['Christian Medical College Vellore', 'Vellore', 'Tamil Nadu', `${T1} · CMC Vellore`, null],
  ['Maulana Azad Medical College', 'New Delhi', 'Delhi', `${T2} · MAMC`, null],
  ['Armed Forces Medical College', 'Pune', 'Maharashtra', `${T2} · AFMC`, null],

  // ---- law, design and social sciences ----
  ['NLSIU Bangalore', 'Bengaluru', 'Karnataka', `${T1} · National Law School of India University`, 'nls.ac.in'],
  ['National Law University Delhi', 'New Delhi', 'Delhi', `${T1} · NLU Delhi`, 'nludelhi.ac.in'],
  ['NALSAR University of Law', 'Hyderabad', 'Telangana', `${T1} · NALSAR`, 'nalsar.ac.in'],
  ['WBNUJS Kolkata', 'Kolkata', 'West Bengal', `${T2} · The West Bengal National University of Juridical Sciences`, 'nujs.edu'],
  ['Tata Institute of Social Sciences', 'Mumbai', 'Maharashtra', `${T1} · TISS, social sciences`, 'tiss.edu'],
  ['National Institute of Design', 'Ahmedabad', 'Gujarat', `${T1} · NID, design`, 'nid.edu'],
  ['NIFT Delhi', 'New Delhi', 'Delhi', `${T2} · National Institute of Fashion Technology`, 'nift.ac.in'],
];

// ---- elite international universities (added once, after the Indian list) ----
// "State" holds the region and country so the directory shows e.g. "Cambridge, Massachusetts, USA".
const E = 'Elite · ';

export const ELITE_FOREIGN_COLLEGES = [
  // ---- United States ----
  ['MIT', 'Cambridge', 'Massachusetts, USA', `${E}Massachusetts Institute of Technology`, 'mit.edu'],
  ['Stanford University', 'Stanford', 'California, USA', `${E}Private research university`, 'stanford.edu'],
  ['Harvard University', 'Cambridge', 'Massachusetts, USA', `${E}Ivy League`, 'harvard.edu'],
  ['Caltech', 'Pasadena', 'California, USA', `${E}California Institute of Technology`, 'caltech.edu'],
  ['Princeton University', 'Princeton', 'New Jersey, USA', `${E}Ivy League`, 'princeton.edu'],
  ['Yale University', 'New Haven', 'Connecticut, USA', `${E}Ivy League`, 'yale.edu'],
  ['Columbia University', 'New York', 'New York, USA', `${E}Ivy League`, 'columbia.edu'],
  ['University of Chicago', 'Chicago', 'Illinois, USA', `${E}Private research university`, 'uchicago.edu'],
  ['University of Pennsylvania', 'Philadelphia', 'Pennsylvania, USA', `${E}Ivy League, home of Wharton`, 'upenn.edu'],
  ['Cornell University', 'Ithaca', 'New York, USA', `${E}Ivy League`, 'cornell.edu'],
  ['Brown University', 'Providence', 'Rhode Island, USA', `${E}Ivy League`, 'brown.edu'],
  ['Duke University', 'Durham', 'North Carolina, USA', `${E}Private research university`, 'duke.edu'],
  ['Northwestern University', 'Evanston', 'Illinois, USA', `${E}Private research university`, 'northwestern.edu'],
  ['Johns Hopkins University', 'Baltimore', 'Maryland, USA', `${E}Private research university`, 'jhu.edu'],
  ['Carnegie Mellon University', 'Pittsburgh', 'Pennsylvania, USA', `${E}Computer science and engineering`, 'cmu.edu'],
  ['UC Berkeley', 'Berkeley', 'California, USA', `${E}University of California, Berkeley`, 'berkeley.edu'],
  ['UCLA', 'Los Angeles', 'California, USA', `${E}University of California, Los Angeles`, 'ucla.edu'],
  ['University of Michigan', 'Ann Arbor', 'Michigan, USA', `${E}Public research university`, 'umich.edu'],

  // ---- United Kingdom ----
  ['University of Oxford', 'Oxford', 'England, UK', `${E}Oxbridge`, 'ox.ac.uk'],
  ['University of Cambridge', 'Cambridge', 'England, UK', `${E}Oxbridge`, 'cam.ac.uk'],
  ['Imperial College London', 'London', 'England, UK', `${E}Science, engineering, medicine and business`, 'imperial.ac.uk'],
  ['UCL', 'London', 'England, UK', `${E}University College London`, 'ucl.ac.uk'],
  ['London School of Economics', 'London', 'England, UK', `${E}LSE, social sciences`, 'lse.ac.uk'],
  ['University of Edinburgh', 'Edinburgh', 'Scotland, UK', `${E}Russell Group`, 'ed.ac.uk'],
  ["King's College London", 'London', 'England, UK', `${E}Russell Group`, 'kcl.ac.uk'],
  ['London Business School', 'London', 'England, UK', `${E}LBS, management`, 'london.edu'],

  // ---- Europe ----
  ['ETH Zurich', 'Zurich', 'Switzerland', `${E}Swiss Federal Institute of Technology`, 'ethz.ch'],
  ['EPFL', 'Lausanne', 'Switzerland', `${E}École Polytechnique Fédérale de Lausanne`, 'epfl.ch'],
  ['Technical University of Munich', 'Munich', 'Germany', `${E}TUM, engineering and technology`, 'tum.de'],
  ['Heidelberg University', 'Heidelberg', 'Germany', `${E}Germany's oldest university`, 'uni-heidelberg.de'],
  ['Université PSL', 'Paris', 'France', `${E}Paris Sciences et Lettres (ENS, Mines Paris and more)`, 'psl.eu'],
  ['École Polytechnique', 'Palaiseau', 'France', `${E}Engineering`, 'polytechnique.edu'],
  ['INSEAD', 'Fontainebleau', 'France', `${E}Management, with campuses in Singapore and Abu Dhabi`, 'insead.edu'],
  ['Delft University of Technology', 'Delft', 'Netherlands', `${E}TU Delft, engineering`, 'tudelft.nl'],
  ['KU Leuven', 'Leuven', 'Belgium', `${E}Research university`, 'kuleuven.be'],
  ['Karolinska Institute', 'Stockholm', 'Sweden', `${E}Medicine and life sciences`, 'ki.se'],

  // ---- Asia ----
  ['National University of Singapore', 'Singapore', 'Singapore', `${E}NUS`, 'nus.edu.sg'],
  ['Nanyang Technological University', 'Singapore', 'Singapore', `${E}NTU`, 'ntu.edu.sg'],
  ['Tsinghua University', 'Beijing', 'China', `${E}Engineering and sciences`, 'tsinghua.edu.cn'],
  ['Peking University', 'Beijing', 'China', `${E}Comprehensive research university`, 'pku.edu.cn'],
  ['University of Hong Kong', 'Hong Kong', 'Hong Kong', `${E}HKU`, 'hku.hk'],
  ['HKUST', 'Hong Kong', 'Hong Kong', `${E}Hong Kong University of Science and Technology`, 'ust.hk'],
  ['University of Tokyo', 'Tokyo', 'Japan', `${E}Japan's leading national university`, 'u-tokyo.ac.jp'],
  ['Kyoto University', 'Kyoto', 'Japan', `${E}National research university`, 'kyoto-u.ac.jp'],
  ['KAIST', 'Daejeon', 'South Korea', `${E}Korea Advanced Institute of Science and Technology`, 'kaist.ac.kr'],
  ['Seoul National University', 'Seoul', 'South Korea', `${E}South Korea's leading national university`, 'snu.ac.kr'],

  // ---- Canada, Australia ----
  ['University of Toronto', 'Toronto', 'Ontario, Canada', `${E}Public research university`, 'utoronto.ca'],
  ['McGill University', 'Montreal', 'Quebec, Canada', `${E}Public research university`, 'mcgill.ca'],
  ['University of British Columbia', 'Vancouver', 'British Columbia, Canada', `${E}Public research university`, 'ubc.ca'],
  ['University of Melbourne', 'Melbourne', 'Victoria, Australia', `${E}Group of Eight`, 'unimelb.edu.au'],
  ['Australian National University', 'Canberra', 'Australian Capital Territory, Australia', `${E}Group of Eight`, 'anu.edu.au'],
  ['University of Sydney', 'Sydney', 'New South Wales, Australia', `${E}Group of Eight`, 'sydney.edu.au'],
];

// ---- turning the lists above into database rows (tier and country are real columns) ----
const COUNTRY_NAMES = { USA: 'United States', UK: 'United Kingdom' };

export function indianRow([name, city, state, description, domain]) {
  const tier = description.startsWith('Tier 1') ? 'Tier 1' : 'Tier 2';
  return { name, city, state, country: 'India', tier, description: description.replace(/^Tier [12] · /, ''), domain, was: { state, description } };
}

export function foreignRow([name, city, state, description, domain]) {
  const parts = state.split(', ');
  const last = parts[parts.length - 1];
  return {
    name,
    city,
    state: parts.length > 1 ? parts.slice(0, -1).join(', ') : null,
    country: COUNTRY_NAMES[last] ?? last,
    tier: 'Elite',
    description: description.replace(/^Elite · /, ''),
    domain,
    was: { state, description },
  };
}
