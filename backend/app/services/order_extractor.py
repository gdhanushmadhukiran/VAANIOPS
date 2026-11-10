import re
from typing import Optional, Tuple
from app.schemas import ExtractedOrderInfo


class OrderExtractor:
    """
    Deterministic rule-based extraction service for work orders in Telugu,
    English, and mixed Telugu-English (Tanglish) speech.
    
    Architectural isolation: this class fulfills a clear extraction interface
    allowing future drop-in replacement with Evon v3.3 when model weights are available.
    """

    # Common honorifics and title markers
    CUSTOMER_PATTERNS = [
        # Conversational direct reply: "Ravi, Honda Activa" or "Suresh, pulsar"
        r"^([A-Z][a-z]+)\s*,\s*(?:[A-Za-z\s]+)",
        # Telugu honorifics: "Ravi garu", "Suresh gaaru", "Kiran gari"
        r"(?:^|[.\s])([A-Z][a-z]+|[A-Za-z\u0C00-\u0C7F]+)\s+(?:garu|gaaru|gari|babu|anna|bhai|sir|ji)\b",
        # Explicit customer marker: "customer Ravi", "peru Suresh", "name is Kiran"
        r"\b(?:customer|client|peru|name\s+(?:is|ga))\s+([A-Za-z\u0C00-\u0C7F]+)\b",
        # Possession markers: "Ravi dhi bike", "Ravi gari vehicle"
        r"\b([A-Z][a-z]+)\s+(?:dhi|yokka|gari)\b",
        # Single standalone name response: "Ravi" or "Suresh."
        r"^([A-Z][a-z]+)\.?$",
    ]

    # Vehicle and asset vocabulary
    ASSET_MAPPINGS = {
        "bike": ["bike", "motorcycle", "two wheeler", "pulsar", "activa", "splendor", "jupiter", "royal enfield", "hero", "honda", "yamaha", "bullet"],
        "car": ["car", "auto", "four wheeler", "swift", "innova", "maruti", "hyundai", "tata", "sedan", "suv"],
        "auto": ["auto", "auto rickshaw", "three wheeler"],
        "tractor": ["tractor"],
        "geyser": ["geyser", "water heater", "heater"],
        "fan": ["ceiling fan", "fan"],
        "motor": ["motor", "water motor", "submersible", "pump"],
        "ac": ["ac", "air conditioner", "split ac", "window ac"],
        "switchboard": ["switchboard", "switch board", "wiring", "meter"],
        "tap": ["tap", "water tap", "faucet", "nalaa"],
        "pipe": ["pipe", "pipeline", "leakage", "drain", "water line"],
        "refrigerator": ["fridge", "refrigerator"],
        "washing machine": ["washing machine"],
    }

    # Service types
    SERVICE_KEYWORDS = [
        ("Brake pad replacement", ["brake pad", "brake pads", "breaks", "brakes", "brake shoes"]),
        ("Oil change & general service", ["oil change", "oil service", "engine oil", "mobil oil"]),
        ("General service", ["general service", "regular service", "full service", "servicing"]),
        ("Water wash", ["water wash", "wash", "washing"]),
        ("Clutch repair", ["clutch", "clutch plate", "clutch cable"]),
        ("Chain & sprocket service", ["chain sprocket", "chain tight", "chain lube"]),
        ("Tyre & puncture repair", ["puncture", "tyre change", "tube", "air check"]),
        ("Battery check & replacement", ["battery", "battery dead", "charging"]),
        ("Electrical wiring", ["wiring", "short circuit", "switch", "light repair", "fuse"]),
        ("Pipe leakage repair", ["pipe leakage", "leakage", "leaking", "pipe change"]),
        ("Motor rewinding", ["motor rewinding", "rewinding", "coil"]),
        ("Tap & fixture repair", ["tap repair", "tap change", "flush repair"]),
    ]

    # Date keywords
    DATE_MAPPINGS = {
        "today": ["today", "eroju", "nedu", "e roju", "ee roju"],
        "tomorrow": ["tomorrow", "repu", "repu podduna", "repu morning"],
        "day after tomorrow": ["day after tomorrow", "ellundi", "yelundi"],
        "monday": ["monday", "somavaram"],
        "tuesday": ["tuesday", "mangalavaram"],
        "wednesday": ["wednesday", "budhavaram"],
        "thursday": ["thursday", "guruvaram"],
        "friday": ["friday", "sukravaram"],
        "saturday": ["saturday", "sanivaram"],
        "sunday": ["sunday", "adivaram"],
    }

    # Time keywords
    TIME_MAPPINGS = {
        "morning": ["morning", "udayam", "poduna", "podduna", "early morning"],
        "afternoon": ["afternoon", "madhyahnam", "madhyanam"],
        "evening": ["evening", "sayantram", "sayanthram", "saayantram"],
        "night": ["night", "raathri", "ratri"],
    }

    def extract(self, transcript: str, language_code: str = "te-IN") -> ExtractedOrderInfo:
        """
        Parses raw transcript and extracts structured fields without hallucination.
        Uncertain fields remain None.
        """
        if not transcript or not transcript.strip():
            return ExtractedOrderInfo()

        text = transcript.strip()
        lower_text = text.lower()

        customer_name = self._extract_customer(text)
        vehicle_or_asset = self._extract_asset(lower_text)
        service_type, description = self._extract_service_and_description(text, lower_text)
        delivery_date = self._extract_delivery_date(lower_text)
        delivery_time = self._extract_delivery_time(lower_text)
        estimated_cost = self._extract_estimated_cost(lower_text)

        return ExtractedOrderInfo(
            intent="create_work_order",
            customer_name=customer_name,
            vehicle_or_asset=vehicle_or_asset,
            service_type=service_type or "General Inspection",
            description=description or text,
            delivery_date=delivery_date,
            delivery_time=delivery_time,
            estimated_cost=estimated_cost,
            status="pending",
            requires_confirmation=True,
        )

    def _extract_customer(self, text: str) -> Optional[str]:
        for pattern in self.CUSTOMER_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                candidate = match.group(1).strip()
                # Exclude obvious non-names
                if candidate.lower() not in {"bike", "car", "service", "repair", "repu", "eroju", "order", "auto", "honda", "pulsar", "activa", "yes", "no"}:
                    return candidate.capitalize()
        return None

    def _extract_asset(self, lower_text: str) -> Optional[str]:
        for standard_asset, aliases in self.ASSET_MAPPINGS.items():
            for alias in aliases:
                # Check word boundaries
                if re.search(r"\b" + re.escape(alias) + r"\b", lower_text):
                    return standard_asset.capitalize()
        return None

    def _extract_service_and_description(self, text: str, lower_text: str) -> Tuple[Optional[str], Optional[str]]:
        detected_service = None
        for standard_name, keywords in self.SERVICE_KEYWORDS:
            for kw in keywords:
                if re.search(r"\b" + re.escape(kw) + r"\b", lower_text):
                    detected_service = standard_name
                    break
            if detected_service:
                break

        # Generate a concise description from sentences mentioning the work or full text
        sentences = [s.strip() for s in re.split(r"[.!?\n]", text) if s.strip()]
        relevant_sentences = []
        action_words = ["repair", "change", "replace", "cheyyali", "chudali", "service", "fix", "leakage", "tight", "cleaning"]
        
        for s in sentences:
            if any(w in s.lower() for w in action_words):
                relevant_sentences.append(s)

        description = " ".join(relevant_sentences) if relevant_sentences else text
        return detected_service, description

    def _extract_delivery_date(self, lower_text: str) -> Optional[str]:
        # Specific date patterns like "10th Nov", "15th", "tomorrow"
        for standard_date, aliases in self.DATE_MAPPINGS.items():
            for alias in aliases:
                if re.search(r"\b" + re.escape(alias) + r"\b", lower_text):
                    return standard_date.capitalize()

        # Date digit regex, e.g. "12/11/2026" or "10th november"
        date_match = re.search(r"\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\b", lower_text)
        if date_match:
            return date_match.group(1).title()

        return None

    def _extract_delivery_time(self, lower_text: str) -> Optional[str]:
        # Direct time like "5 PM", "10:30 AM"
        time_clock = re.search(r"\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b", lower_text)
        if time_clock:
            return time_clock.group(1).upper()

        # Time of day keywords
        for standard_time, aliases in self.TIME_MAPPINGS.items():
            for alias in aliases:
                if re.search(r"\b" + re.escape(alias) + r"\b", lower_text):
                    return standard_time.lower()

        return None

    def _extract_estimated_cost(self, lower_text: str) -> Optional[float]:
        # "1500 rupees", "2000 rs", "rs 1500", "₹1500"
        patterns = [
            r"(?:rs\.?|inr|₹|roopayalu)\s*(\d+(?:,\d+)*(?:\.\d+)?)",
            r"(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:rs\.?|inr|rupees|roopayalu)",
        ]
        for pattern in patterns:
            match = re.search(pattern, lower_text)
            if match:
                raw_num = match.group(1).replace(",", "")
                try:
                    val = float(raw_num)
                    if 10 <= val <= 1000000:
                        return val
                except ValueError:
                    continue
        return None


order_extractor = OrderExtractor()

